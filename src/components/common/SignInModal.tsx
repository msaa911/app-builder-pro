import React, { useEffect, useCallback } from 'react';

/**
 * SignInModal — "Coming Soon" placeholder for authentication UI slot (LPL-010).
 * Dismissible via close button, overlay click, and Escape key.
 */
interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="signin-modal-overlay"
      data-testid="signin-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="signin-modal glass"
        role="dialog"
        aria-label="Sign In"
        data-testid="signin-modal"
      >
        <button
          className="signin-modal-close"
          data-testid="signin-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <h2 className="signin-modal-title">Sign In</h2>
        <p className="signin-modal-coming-soon">🚀 Coming Soon</p>
        <p className="signin-modal-description">
          Authentication is on the way. Stay tuned for Supabase-powered sign in.
        </p>
      </div>
    </div>
  );
};

export default SignInModal;
