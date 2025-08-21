// frontend_modern/src/components/ErrorState.tsx
import React from 'react';

interface ErrorStateProps {
    message: string;
    onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            padding: '24px',
            textAlign: 'center',
            height: '100%',
        }}>
            <span
                className="material-symbols-rounded"
                style={{ fontSize: '64px', opacity: 0.5, marginBottom: '16px' }}
            >
                error
            </span>
            <h3 style={{ marginBottom: '8px' }}>Ой! Что-то пошло не так.</h3>
            <p style={{ opacity: 0.7, marginBottom: '24px' }}>{message}</p>
            <button
                onClick={onRetry}
                style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--on-accent-color)',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 500
                }}
            >
                Попробовать снова
            </button>
        </div>
    );
};

export default ErrorState;