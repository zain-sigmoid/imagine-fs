import React, { useState } from "react";

const ViewModal = ({ previewSrc, index = 0 }) => {
  return (
    <div
      className={`modal fade animate__animated animate__zoomIn`}
      id="viewModal"
      tabindex="-1"
      aria-labelledby="viewModalLabel"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-body rounded" style={{ padding: "2px" }}>
            <img
              src={previewSrc}
              alt={`Preview for combo ${index + 1}`}
              className="img-fluid rounded"
            />
          </div>
          <div
            className="modal-footer"
            style={{ backgroundColor: "transparent" }}
          >
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              data-bs-dismiss="modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewModal;
