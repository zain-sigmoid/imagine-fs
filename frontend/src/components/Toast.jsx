import { useCallback, useEffect, useRef } from "react";

const AUTO_HIDE_DELAY = 4000;

const Toast = ({
  content,
  copy = false,
  msg = "",
  variant = "primary",
  onClose,
}) => {
  const toastRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  const handleClose = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    const element = toastRef.current;
    if (element) {
      element.classList.remove("show");
    }
    if (typeof onClose === "function") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const element = toastRef.current;
    if (!element) {
      return;
    }

    if (copy && content && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(content).catch(() => {});
    }

    requestAnimationFrame(() => {
      element.classList.add("show");
    });

    hideTimeoutRef.current = setTimeout(handleClose, AUTO_HIDE_DELAY);

    return () => {
      clearTimeout(hideTimeoutRef.current);
    };
  }, [content, copy, handleClose]);

  return (
    <div
      ref={toastRef}
      className={`toast align-items-center text-bg-${variant} border position-fixed bottom-0 end-0 m-3 show`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{ zIndex: 2000 }}
    >
      <div className="d-flex">
        <div className="toast-body">
          {copy ? `${msg} copied to clipboard` : content}
        </div>
        <button
          type="button"
          className="btn-close btn-close-white me-2 m-auto"
          aria-label="Close"
          onClick={handleClose}
        ></button>
      </div>
    </div>
  );
};

export default Toast;
