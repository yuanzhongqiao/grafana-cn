import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t } from 'app/core/internationalization';

import { DismissableButton } from './DismissableButton';

export interface ReturnToPreviousProps {
  href: string;
  title: string;
}

export const ReturnToPrevious = ({ href, title }: ReturnToPreviousProps) => {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const handleOnClick = () => {
    locationService.push(href);
    chrome.clearReturnToPrevious();
  };
  const handleOnDismiss = () => {
    chrome.clearReturnToPrevious();
  };

  return (
    <div className={styles.returnToPrevious}>
      <DismissableButton
        label={t('return-to-previous.button.label', 'Back to {{title}}', { title })}
        onClick={handleOnClick}
        onDismiss={handleOnDismiss}
      />
    </div>
  );
};
const getStyles = (theme: GrafanaTheme2) => ({
  returnToPrevious: css({
    label: 'return-to-previous',
    display: 'flex',
    justifyContent: 'center',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.portal,
    position: 'fixed',
    bottom: theme.spacing.x4,
  }),
});

ReturnToPrevious.displayName = 'ReturnToPrevious';
