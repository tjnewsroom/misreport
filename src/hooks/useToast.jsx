import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div style={{
          position:'fixed', top:18, left:'50%', transform:'translateX(-50%)',
          padding:'10px 22px', borderRadius:100, fontSize:13, fontWeight:500,
          zIndex:9999, whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,.1)',
          background: toast.type === 'er' ? '#fef2f2' : '#ecfdf5',
          color: toast.type === 'er' ? '#dc2626' : '#059669',
          border: `1px solid ${toast.type === 'er' ? 'rgba(220,38,38,.3)' : 'rgba(5,150,105,.3)'}`,
          animation:'slideDown .35s cubic-bezier(.34,1.56,.64,1)',
        }}>
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
