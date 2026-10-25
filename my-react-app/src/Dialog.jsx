import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const DialogContext = createContext(null)

// 提供 confirm(message) -> Promise<boolean> 與 alert(message) -> Promise<void>
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const open = useCallback(
    (type, message) =>
      new Promise((resolve) => setDialog({ type, message, resolve })),
    [],
  )
  const api = useMemo(
    () => ({
      confirm: (m) => open('confirm', m),
      alert: (m) => open('alert', m),
    }),
    [open],
  )
  const close = (result) => {
    dialog.resolve(result)
    setDialog(null)
  }

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="dialog">
            <p>{dialog.message}</p>
            <div className="dialog-actions">
              {dialog.type === 'confirm' && (
                <button onClick={() => close(false)}>取消</button>
              )}
              <button className="primary" onClick={() => close(true)}>
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDialog = () => useContext(DialogContext)
