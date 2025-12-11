import React, { useState, useContext, useRef } from "react";
import { userContext } from "../context/userContext";

const Modal = ({ deleteAll, alert }) => {
  const [deloader, setDeloader] = useState(false);
  const ref = useRef();
  const { setRecentImages, setRelatedImages, setRelatedTotal, setRecentTotal } =
    useContext(userContext);

  const handleDelete = async () => {
    setDeloader(true);
    try {
      await deleteAll();
      setRecentTotal(0);
      setRelatedTotal(0);
      setRelatedImages([]);
      setRecentImages([]);
      alert("Deleted All Images Successfully");
    } catch (error) {
      alert("Unable to delete the images");
      console.error(error);
    } finally {
      setDeloader(true);
      ref.current.click();
    }
  };
  return (
    <div
      class="modal fade"
      id="exampleModal"
      tabindex="-1"
      aria-labelledby="exampleModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body">{`Are you sure you want to delete All Images`}</div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-bs-dismiss="modal"
              ref={ref}
            >
              Close
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={deloader}
            >
              {deloader ? (
                <span>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Deleteing..
                </span>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
