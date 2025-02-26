package apiserver

import (
	"fmt"
	"io"
	"net"
	"path"

	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/tools/clientcmd"
	netutils "k8s.io/utils/net"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	defaultEtcdPathPrefix = "/registry/grafana.app"
	dataPath              = "data/grafana-apiserver" // same as grafana core
)

// APIServerOptions contains the state for the apiserver
type APIServerOptions struct {
	builders           []grafanaAPIServer.APIGroupBuilder
	RecommendedOptions *options.RecommendedOptions
	AlternateDNS       []string

	StdOut io.Writer
	StdErr io.Writer
}

func newAPIServerOptions(out, errOut io.Writer) *APIServerOptions {
	return &APIServerOptions{
		StdOut: out,
		StdErr: errOut,
	}
}

func (o *APIServerOptions) loadAPIGroupBuilders(args []string) error {
	o.builders = []grafanaAPIServer.APIGroupBuilder{}
	for _, g := range args {
		switch g {
		// No dependencies for testing
		case "example.grafana.app":
			o.builders = append(o.builders, example.NewTestingAPIBuilder())
		case "featuretoggle.grafana.app":
			features := featuremgmt.WithFeatureManager(setting.FeatureMgmtSettings{}, nil) // none... for now
			o.builders = append(o.builders, featuretoggle.NewFeatureFlagAPIBuilder(features))
		case "testdata.datasource.grafana.app":
			ds, err := server.InitializeDataSourceAPIServer(g)
			if err != nil {
				return err
			}
			o.builders = append(o.builders, ds)
		default:
			return fmt.Errorf("unknown group: %s", g)
		}
	}

	if len(o.builders) < 1 {
		return fmt.Errorf("expected group name(s) in the command line arguments")
	}

	// Install schemas
	for _, b := range o.builders {
		if err := b.InstallSchema(grafanaAPIServer.Scheme); err != nil {
			return err
		}
	}
	return nil
}

// A copy of ApplyTo in recommended.go, but for >= 0.28, server pkg in apiserver does a bit extra causing
// a panic when CoreAPI is set to nil
func (o *APIServerOptions) ModifiedApplyTo(config *genericapiserver.RecommendedConfig) error {
	if err := o.RecommendedOptions.Etcd.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.EgressSelector.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Traces.ApplyTo(config.Config.EgressSelector, &config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.SecureServing.ApplyTo(&config.Config.SecureServing, &config.Config.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authentication.ApplyTo(&config.Config.Authentication, config.SecureServing, config.OpenAPIConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authorization.ApplyTo(&config.Config.Authorization); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Audit.ApplyTo(&config.Config); err != nil {
		return err
	}

	// TODO: determine whether we need flow control (API priority and fairness)
	// We can't assume that a shared informers config was provided in standalone mode and will need a guard
	// when enabling below
	/* kubeClient, err := kubernetes.NewForConfig(config.ClientConfig)
	if err != nil {
		return err
	}

	if err := o.RecommendedOptions.Features.ApplyTo(&config.Config, kubeClient, config.SharedInformerFactory); err != nil {
		return err
	} */

	if err := o.RecommendedOptions.CoreAPI.ApplyTo(config); err != nil {
		return err
	}

	_, err := o.RecommendedOptions.ExtraAdmissionInitializers(config)
	if err != nil {
		return err
	}
	return nil
}

func (o *APIServerOptions) Config() (*genericapiserver.RecommendedConfig, error) {
	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts(
		"localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")},
	); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true

	// TODO: determine authorization, currently insecure because Authorization provided by recommended options doesn't work
	// reason: an aggregated server won't be able to post subjectaccessreviews (Grafana doesn't have this kind)
	// exact error: the server could not find the requested resource (post subjectaccessreviews.authorization.k8s.io)
	o.RecommendedOptions.Authorization = nil

	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.Etcd = nil

	if o.RecommendedOptions.CoreAPI.CoreAPIKubeconfigPath == "" {
		o.RecommendedOptions.CoreAPI = nil
	}

	serverConfig := genericapiserver.NewRecommendedConfig(grafanaAPIServer.Codecs)

	if o.RecommendedOptions.CoreAPI == nil {
		if err := o.ModifiedApplyTo(serverConfig); err != nil {
			return nil, err
		}
	} else {
		if err := o.RecommendedOptions.ApplyTo(serverConfig); err != nil {
			return nil, err
		}
	}

	serverConfig.DisabledPostStartHooks = serverConfig.DisabledPostStartHooks.Insert("generic-apiserver-start-informers")
	serverConfig.DisabledPostStartHooks = serverConfig.DisabledPostStartHooks.Insert("priority-and-fairness-config-consumer")

	// Add OpenAPI specs for each group+version
	err := grafanaAPIServer.SetupConfig(serverConfig, o.builders)
	return serverConfig, err
}

// Validate validates APIServerOptions
// NOTE: we don't call validate on the top level recommended options as it doesn't like skipping etcd-servers
// the function is left here for troubleshooting any other config issues
func (o *APIServerOptions) Validate(args []string) error {
	errors := []error{}
	errors = append(errors, o.RecommendedOptions.Validate()...)
	return utilerrors.NewAggregate(errors)
}

// Complete fills in fields required to have valid data
func (o *APIServerOptions) Complete() error {
	return nil
}

func (o *APIServerOptions) RunAPIServer(config *genericapiserver.RecommendedConfig, stopCh <-chan struct{}) error {
	delegationTarget := genericapiserver.NewEmptyDelegate()
	completedConfig := config.Complete()

	server, err := completedConfig.New("example-apiserver", delegationTarget)
	if err != nil {
		return err
	}

	// Install the API Group+version
	err = grafanaAPIServer.InstallAPIs(server, config.RESTOptionsGetter, o.builders)
	if err != nil {
		return err
	}

	// write the local config to disk
	if err = clientcmd.WriteToFile(
		utils.FormatKubeConfig(server.LoopbackClientConfig),
		path.Join(dataPath, "apiserver.kubeconfig"),
	); err != nil {
		return err
	}

	return server.PrepareRun().Run(stopCh)
}
