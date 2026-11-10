import React from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  return (
    <div className="min-h-screen bg-surface text-on-surface p-8">
      <h1 className="font-mono text-headline-lg text-primary-container">LogiCam.io</h1>
      <p className="font-sans text-body-md text-on-surface-variant">Industrial Fleet OS</p>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
