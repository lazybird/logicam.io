import { useEffect } from 'react';

/**
 * Hook to close modals or popups when Escape key is pressed.
 * @param isOpen whether the modal is currently open
 * @param onClose callback when Escape is pressed
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
