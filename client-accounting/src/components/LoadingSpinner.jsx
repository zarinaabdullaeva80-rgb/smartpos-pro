import React from 'react';
import './LoadingSpinner.css';

/**
 * Loading spinner component for React.lazy Suspense fallback
 */
function LoadingSpinner({ message = 'Загрузка...' }) {
    return (
        <div className="loading-spinner-container">
            <div className="loading-spinner">
                <div className="spinner"></div>
                <p className="loading-message">{message}</p>
            </div>
        </div>
    );
}

export default LoadingSpinner;
