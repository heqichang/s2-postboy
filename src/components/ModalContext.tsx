import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface AlertOptions {
  title?: string
  message: string
  onClose?: () => void
}

interface ConfirmOptions {
  title?: string
  message: string
  onConfirm: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
}

interface PromptOptions {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  onConfirm: (value: string) => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  inputType?: 'text' | 'password'
}

interface ModalState {
  alert: AlertOptions | null
  confirm: ConfirmOptions | null
  prompt: PromptOptions | null
}

interface ModalContextType {
  showAlert: (options: AlertOptions) => void
  showConfirm: (options: ConfirmOptions) => void
  showPrompt: (options: PromptOptions) => void
  closeAll: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

export function useModal(): ModalContextType {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ModalProviderProps {
  children: ReactNode
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modalState, setModalState] = useState<ModalState>({
    alert: null,
    confirm: null,
    prompt: null,
  })
  const [promptValue, setPromptValue] = useState('')

  const showAlert = useCallback((options: AlertOptions) => {
    setModalState((prev) => ({ ...prev, alert: options }))
  }, [])

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setModalState((prev) => ({ ...prev, confirm: options }))
  }, [])

  const showPrompt = useCallback((options: PromptOptions) => {
    setPromptValue(options.defaultValue || '')
    setModalState((prev) => ({ ...prev, prompt: options }))
  }, [])

  const closeAll = useCallback(() => {
    setModalState({ alert: null, confirm: null, prompt: null })
  }, [])

  const handleAlertClose = useCallback(() => {
    const alert = modalState.alert
    setModalState((prev) => ({ ...prev, alert: null }))
    if (alert?.onClose) {
      alert.onClose()
    }
  }, [modalState.alert])

  const handleConfirmConfirm = useCallback(() => {
    const confirm = modalState.confirm
    setModalState((prev) => ({ ...prev, confirm: null }))
    if (confirm?.onConfirm) {
      confirm.onConfirm()
    }
  }, [modalState.confirm])

  const handleConfirmCancel = useCallback(() => {
    const confirm = modalState.confirm
    setModalState((prev) => ({ ...prev, confirm: null }))
    if (confirm?.onCancel) {
      confirm.onCancel()
    }
  }, [modalState.confirm])

  const handlePromptConfirm = useCallback(() => {
    const prompt = modalState.prompt
    setModalState((prev) => ({ ...prev, prompt: null }))
    if (prompt?.onConfirm) {
      prompt.onConfirm(promptValue)
    }
  }, [modalState.prompt, promptValue])

  const handlePromptCancel = useCallback(() => {
    const prompt = modalState.prompt
    setModalState((prev) => ({ ...prev, prompt: null }))
    if (prompt?.onCancel) {
      prompt.onCancel()
    }
  }, [modalState.prompt])

  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePromptConfirm()
    } else if (e.key === 'Escape') {
      handlePromptCancel()
    }
  }, [handlePromptConfirm, handlePromptCancel])

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, closeAll }}>
      {children}

      {modalState.alert && (
        <div className="modal-overlay" onClick={handleAlertClose}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalState.alert.title || '提示'}</h3>
              <button className="modal-close" onClick={handleAlertClose}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-message">{modalState.alert.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleAlertClose}>确定</button>
            </div>
          </div>
        </div>
      )}

      {modalState.confirm && (
        <div className="modal-overlay" onClick={handleConfirmCancel}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalState.confirm.title || '确认'}</h3>
              <button className="modal-close" onClick={handleConfirmCancel}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-message">{modalState.confirm.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleConfirmCancel}>
                {modalState.confirm.cancelText || '取消'}
              </button>
              <button className="btn btn-primary" onClick={handleConfirmConfirm}>
                {modalState.confirm.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalState.prompt && (
        <div className="modal-overlay" onClick={handlePromptCancel}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalState.prompt.title || '输入'}</h3>
              <button className="modal-close" onClick={handlePromptCancel}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-message">{modalState.prompt.message}</p>
              <input
                type={modalState.prompt.inputType || 'text'}
                className="form-input"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder={modalState.prompt.placeholder || ''}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handlePromptCancel}>
                {modalState.prompt.cancelText || '取消'}
              </button>
              <button className="btn btn-primary" onClick={handlePromptConfirm}>
                {modalState.prompt.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}
