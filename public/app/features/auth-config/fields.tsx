import React from 'react';
import { validate as uuidValidate } from 'uuid';

import { TextLink } from '@grafana/ui';

import { FieldData, SSOProvider, SSOSettingsField } from './types';
import { isSelectableValue } from './utils/guards';

/** Map providers to their settings */
export const fields: Record<SSOProvider['provider'], Array<keyof SSOProvider['settings']>> = {
  github: ['clientId', 'clientSecret', 'teamIds', 'allowedOrganizations'],
  google: ['clientId', 'clientSecret', 'allowedDomains'],
  gitlab: ['clientId', 'clientSecret', 'allowedOrganizations', 'teamIds'],
  azuread: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'scopes', 'allowedGroups', 'allowedDomains'],
  okta: [
    'clientId',
    'clientSecret',
    'authUrl',
    'tokenUrl',
    'apiUrl',
    'roleAttributePath',
    'allowedGroups',
    'allowedDomains',
  ],
};

type Section = Record<
  SSOProvider['provider'],
  Array<{
    name: string;
    id: string;
    hidden?: boolean;
    fields: SSOSettingsField[];
  }>
>;

export const sectionFields: Section = {
  generic_oauth: [
    {
      name: 'General settings',
      id: 'general',
      fields: [
        'name',
        'clientId',
        'clientSecret',
        'authStyle',
        'scopes',
        'authUrl',
        'tokenUrl',
        'apiUrl',
        'allowSignUp',
        'autoLogin',
        'signoutRedirectUrl',
      ],
    },
    {
      name: 'User mapping',
      id: 'user',
      fields: [
        'nameAttributePath',
        'loginAttributePath',
        'emailAttributeName',
        'emailAttributePath',
        'idTokenAttributeName',
        'roleAttributePath',
        'roleAttributeStrict',
        'allowAssignGrafanaAdmin',
        'skipOrgRoleSync',
      ],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'allowedOrganizations',
        'allowedDomains',
        'defineAllowedGroups',
        { name: 'allowedGroups', dependsOn: 'defineAllowedGroups' },
        { name: 'groupsAttributePath', dependsOn: 'defineAllowedGroups' },
        'defineAllowedTeamsIds',
        { name: 'teamIds', dependsOn: 'defineAllowedTeamsIds' },
        { name: 'teamsUrl', dependsOn: 'defineAllowedTeamsIds' },
        { name: 'teamIdsAttributePath', dependsOn: 'defineAllowedTeamsIds' },
        'usePkce',
        'useRefreshToken',
      ],
    },
    {
      name: 'TLS',
      id: 'tls',
      fields: ['configureTLS', 'tlsSkipVerifyInsecure', 'tlsClientCert', 'tlsClientKey', 'tlsClientCa'],
    },
  ],
};

/**
 * List all the fields that can be used in the form
 */
export function fieldMap(provider: string): Record<string, FieldData> {
  return {
    clientId: {
      label: 'Client Id',
      type: 'text',
      description: 'The client Id of your OAuth2 app.',
      validation: {
        required: true,
        message: 'This field is required',
      },
    },
    clientSecret: {
      label: 'Client secret',
      type: 'secret',
      description: 'The client secret of your OAuth2 app.',
    },
    allowedOrganizations: {
      label: 'Allowed organizations',
      type: 'select',
      description:
        'List of comma- or space-separated organizations. The user should be a member \n' +
        'of at least one organization to log in.',
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: 'Enter organizations (my-team, myteam...) and press Enter to add',
    },
    allowedDomains: {
      label: 'Allowed domains',
      type: 'select',
      description:
        'List of comma- or space-separated domains. The user should belong to at least \n' + 'one domain to log in.',
      multi: true,
      allowCustomValue: true,
      options: [],
    },
    authUrl: {
      label: 'Auth URL',
      type: 'text',
      description: 'The authorization endpoint of your OAuth2 provider.',
      validation: {
        required: false,
      },
    },
    authStyle: {
      label: 'Auth style',
      type: 'select',
      description: 'It determines how client_id and client_secret are sent to Oauth2 provider. Default is AutoDetect.',
      multi: false,
      options: [
        { value: 'AutoDetect', label: 'AutoDetect' },
        { value: 'InParams', label: 'InParams' },
        { value: 'InHeader', label: 'InHeader' },
      ],
      defaultValue: 'AutoDetect',
    },
    tokenUrl: {
      label: 'Token URL',
      type: 'text',
      description: 'The token endpoint of your OAuth2 provider.',
      validation: {
        required: false,
      },
    },
    scopes: {
      label: 'Scopes',
      type: 'select',
      description: 'List of comma- or space-separated OAuth2 scopes.',
      multi: true,
      allowCustomValue: true,
      options: [],
    },
    allowedGroups: {
      label: 'Allowed groups',
      type: 'select',
      description:
        'List of comma- or space-separated groups. The user should be a member of \n' +
        'at least one group to log in. If you configure allowed_groups, you must also configure \n' +
        'groups_attribute_path.',
      multi: true,
      allowCustomValue: true,
      options: [],
      validation:
        provider === 'azuread'
          ? {
              validate: (value) => {
                if (typeof value === 'string') {
                  return uuidValidate(value);
                }
                if (isSelectableValue(value)) {
                  return value.every((v) => v?.value && uuidValidate(v.value));
                }
                return true;
              },
              message: 'Allowed groups must be Object Ids.',
            }
          : undefined,
    },
    apiUrl: {
      label: 'API URL',
      type: 'text',
      description: (
        <>
          The user information endpoint of your OAuth2 provider. Information returned by this endpoint must be
          compatible with{' '}
          <TextLink href={'https://connect2id.com/products/server/docs/api/userinfo'} external variant={'bodySmall'}>
            OpenID UserInfo
          </TextLink>
          .
        </>
      ),
      validation: {
        required: false,
      },
    },
    roleAttributePath: {
      label: 'Role attribute path',
      description: 'JMESPath expression to use for Grafana role lookup.',
      type: 'text',
      validation: {
        required: false,
      },
    },
    name: {
      label: 'Display name',
      description: 'Helpful if you use more than one identity providers or SSO protocols.',
      type: 'text',
    },
    allowSignUp: {
      label: 'Allow sign up',
      description: 'If not enabled, only existing Grafana users can log in using OAuth.',
      type: 'switch',
    },
    autoLogin: {
      label: 'Auto login',
      description: 'Log in automatically, skipping the login screen.',
      type: 'switch',
    },
    signoutRedirectUrl: {
      label: 'Sign out redirect URL',
      description: 'The URL to redirect the user to after signing out from Grafana.',
      type: 'text',
      validation: {
        required: false,
      },
    },
    emailAttributeName: {
      label: 'Email attribute name',
      description: 'Name of the key to use for user email lookup within the attributes map of OAuth2 ID token.',
      type: 'text',
    },
    emailAttributePath: {
      label: 'Email attribute path',
      description: 'JMESPath expression to use for user email lookup from the user information.',
      type: 'text',
    },
    nameAttributePath: {
      label: 'Name attribute path',
      description:
        'JMESPath expression to use for user name lookup from the user ID token. \n' +
        'This name will be used as the user’s display name.',
      type: 'text',
    },
    loginAttributePath: {
      label: 'Login attribute path',
      description: 'JMESPath expression to use for user login lookup from the user ID token.',
      type: 'text',
    },
    idTokenAttributeName: {
      label: 'ID token attribute name',
      description: 'The name of the key used to extract the ID token from the returned OAuth2 token.',
      type: 'text',
    },
    roleAttributeStrict: {
      label: 'Role attribute strict mode',
      description: 'If enabled, denies user login if the Grafana role cannot be extracted using Role attribute path.',
      type: 'switch',
    },
    allowAssignGrafanaAdmin: {
      label: 'Allow assign Grafana admin',
      description: 'If enabled, it will automatically sync the Grafana server administrator role.',
      type: 'switch',
    },
    skipOrgRoleSync: {
      label: 'Skip organization role sync',
      description: 'Prevent synchronizing users’ organization roles from your IdP.',
      type: 'switch',
    },
    defineAllowedGroups: {
      label: 'Define allowed groups',
      type: 'switch',
    },
    defineAllowedTeamsIds: {
      label: 'Define allowed teams ids',
      type: 'switch',
    },
    usePkce: {
      label: 'Use PKCE',
      description: (
        <>
          If enabled, Grafana will use{' '}
          <TextLink external variant={'bodySmall'} href={'https://datatracker.ietf.org/doc/html/rfc7636'}>
            Proof Key for Code Exchange (PKCE)
          </TextLink>{' '}
          with the OAuth2 Authorization Code Grant.
        </>
      ),
      type: 'checkbox',
    },
    useRefreshToken: {
      label: 'Use refresh token',
      description:
        'If enabled, Grafana will fetch a new access token using the refresh token provided by the OAuth2 provider.',
      type: 'checkbox',
    },
    configureTLS: {
      label: 'Configure TLS',
      type: 'switch',
    },
    tlsClientCa: {
      label: 'TLS client ca',
      description: 'The path to the trusted certificate authority list. Does not applicable on Grafana Cloud.',
      type: 'text',
    },
    tlsClientCert: {
      label: 'TLS client cert',
      description: 'The path to the certificate. Does not applicable on Grafana Cloud.',
      type: 'text',
    },
    tlsClientKey: {
      label: 'TLS client key',
      description: 'The path to the key. Does not applicable on Grafana Cloud.',
      type: 'text',
    },
    tlsSkipVerifyInsecure: {
      label: 'TLS skip verify',
      description:
        'If enabled, the client accepts any certificate presented by the server and any host \n' +
        'name in that certificate. You should only use this for testing, because this mode leaves \n' +
        'SSL/TLS susceptible to man-in-the-middle attacks.',
      type: 'switch',
    },
    groupsAttributePath: {
      label: 'Groups attribute path',
      description:
        'JMESPath expression to use for user group lookup. If you configure allowed_groups, \n' +
        'you must also configure groupsƒ_attribute_path.',
      type: 'text',
    },
    teamsUrl: {
      label: 'Teams URL',
      description:
        'The URL used to query for Team Ids. If not set, the default value is /teams. \n' +
        'If you configure teams_url, you must also configure team_ids_attribute_path.',
      type: 'text',
      validation: {
        validate: (value, formValues) => {
          if (formValues.teamIds.length) {
            return !!value;
          }
          return true;
        },
        message: 'This field must be set if Team Ids are configured.',
      },
    },
    teamIdsAttributePath: {
      label: 'Team Ids attribute path',
      description:
        'The JMESPath expression to use for Grafana Team Id lookup within the results returned by the teams_url endpoint.',
      type: 'text',
      validation: {
        validate: (value, formValues) => {
          if (formValues.teamIds.length) {
            return !!value;
          }
          return true;
        },
        message: 'This field must be set if Team Ids are configured.',
      },
    },
    teamIds: {
      label: 'Team Ids',
      type: 'select',
      description:
        'String list of Team Ids. If set, the user must be a member of one of the given teams to log in. \n' +
        'If you configure team_ids, you must also configure teams_url and team_ids_attribute_path.',
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: 'Enter Team Ids and press Enter to add',
      validation:
        provider === 'github'
          ? {
              validate: (value) => {
                if (typeof value === 'string') {
                  return isNumeric(value);
                }
                if (isSelectableValue(value)) {
                  return value.every((v) => v?.value && isNumeric(v.value));
                }
                return true;
              },
              message: 'Team Ids must be numbers.',
            }
          : undefined,
    },
  };
}

// Check if a string contains only numeric values
function isNumeric(value: string) {
  return /^-?\d+$/.test(value);
}
