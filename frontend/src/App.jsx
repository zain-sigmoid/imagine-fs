import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Alert from "./components/Alert";
import Toast from "./components/Toast";
import Scrolltotop from "./components/Scrolltotop";
import Home from "./pages/Home";
import Wrong from "./pages/Wrong";

function App() {
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState(null);

  const showAlert = (message, type) => {
    setAlert({
      msg: message,
      type: type,
    });
    setTimeout(() => {
      setAlert(null);
    }, 3500);
  };

  const showToast = (content, copy = false, msg = "", variant = "primary") => {
    console.log(content, copy, msg);
    setToast({
      content,
      copy,
      msg,
      variant,
    });
  };

  const handleToastClose = () => {
    setToast(null);
  };

  return (
    <>
      <Router>
        <Alert alert={alert} />
        <Scrolltotop />
        {toast && (
          <Toast
            content={toast.content}
            copy={toast.copy}
            msg={toast.msg}
            variant={toast.variant}
            onClose={handleToastClose}
          />
        )}
        <Routes>
          <Route
            exact
            path="/"
            element={<Home prop={{ showAlert, showToast }} />}
          ></Route>
          <Route
            exact
            path="/:wrong"
            element={<Wrong prop={{ showAlert, showToast }} />}
          ></Route>
        </Routes>
      </Router>
    </>
  );
}

export default App;
