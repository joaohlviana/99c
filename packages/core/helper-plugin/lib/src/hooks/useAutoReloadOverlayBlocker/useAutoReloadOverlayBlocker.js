/**
 *
 * useAutoReloadOverlayBlocker
 *
 */

import { useContext, useRef } from 'react';
import { AutoReloadOverlayBlockerContext } from '../../contexts/AutoReloadOverlayBlockerContext';

const useAutoReloadOverlayBlocker = () => {
  const { lockApp, unlockApp } = useContext(AutoReloadOverlayBlockerContext);
  // Use a ref so we can safely add the components or the fields
  // to a hook dependencies array
  const lockAppRef = useRef(lockApp);
  const unlockAppRef = useRef(unlockApp);

  return {
    lockAppWithAutoreload: lockAppRef.current,
    unlockAppWithAutoreload: unlockAppRef.current,
  };
};

export { useAutoReloadOverlayBlocker };
