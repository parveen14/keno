import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0060ac',
          colorInfo: '#00aeef',
          colorLink: '#0060ac',
          colorText: '#333333',
          colorTextSecondary: '#666666',
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          borderRadius: 8,
        },
        components: {
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemColor: 'rgba(255,255,255,0.65)',
            darkItemHoverBg: 'rgba(255,255,255,0.06)',
            darkItemHoverColor: '#ffffff',
            darkItemSelectedBg: 'rgba(0,174,239,0.16)',
            darkItemSelectedColor: '#ffffff',
            darkGroupTitleColor: 'rgba(255,255,255,0.35)',
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>
);
