import React, { useEffect, useContext, useLayoutEffect } from "react";
import PlaceHolderCard from "../../../components/layout/PlaceHolderCard";
import { useNavigate } from "react-router-dom";
import { userContext } from "../../../context/userContext";
import { TYPE_ICON } from "../../../config/icons";
import "../styling/card.css";

const Previous = ({
  recentImages,
  onUseImage,
  onDeleteImage,
  items,
  downloadImage,
  loading,
  setLoading,
  hasRecent,
  setHasRecent,
}) => {
  const { loadRecentImages, recentTotal } = useContext(userContext);
  const list = items ?? recentImages ?? [];
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
    );
  }, []);

  useEffect(() => {
    if (hasRecent) return;
    setHasRecent(true);
    const updateRecent = async () => {
      setLoading(true);
      await loadRecentImages();
      setLoading(false);
    };
    updateRecent();
  }, []);

  return (
    <div className="row g-4">
      {list.length > 0 ? (
        list.map((img) => {
          const preview = img?.variants?.medium?.data_b64;
          const name = img?.name?.join(", ");
          const combo = img?.combo;
          const combo_key = [
            "color_palette",
            "finish",
            "motif",
            "pattern",
            "style",
          ];

          return (
            <div key={img.id} className="col-md-4">
              <div className="card shadow-sm h-100 position-relative">
                {/* Image */}
                <div className="img-hover-container">
                  <img
                    src={`data:${img.variants.medium.mime_type};base64,${preview}`}
                    alt={name}
                    className="card-img-top zoom-image"
                    style={{ objectFit: "cover", height: "220px" }}
                  />
                  <div className="card-img-overlay-hover">
                    <div className="overlay-text">{img?.theme}</div>
                    <div className="overlay-text">
                      <i
                        className={`fa-solid ${TYPE_ICON[img?.type]} me-1`}
                      ></i>
                      {img?.type}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="card-body">
                  <div className="mb-3">
                    <p
                      className="fw-semibold text-secondary"
                      style={{ margin: "5px 0" }}
                    >
                      Design
                    </p>
                    {combo_key.map((keyName) => (
                      <span
                        key={keyName}
                        className="badge text-bg-light fw-normal me-2 mb-1 border border-info"
                      >
                        {combo[keyName]}
                      </span>
                    ))}
                  </div>

                  {combo.rationale && (
                    <div style={{ position: "relative", marginBottom: "10px" }}>
                      <div
                        style={{
                          maxHeight: "60px",
                          overflowY: "auto",
                          paddingRight: "5px", // Space for scrollbar
                        }}
                      >
                        <p className="small text-muted mb-0">
                          <strong>Rationale:</strong> {combo.rationale}
                        </p>
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          width: "100%",
                          height: "20px",
                          background: "linear-gradient(transparent, white)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="position-absolute top-0 start-0 end-0 p-2 d-flex flex-row gap-2 justify-content-between align-items-center">
                  <div className="glass-icon-circle">
                    <i
                      className="fa-solid fa-info fa-xs"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      // data-bs-custom-class="custom-tooltip"
                      data-bs-title="Hover on image to view theme and type"
                    ></i>
                  </div>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-sm glass-button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>

                    <ul className="dropdown-menu dropdown-menu-end glass-dropdown">
                      <li style={{ fontSize: "16px" }}>
                        <button
                          className="dropdown-item"
                          type="button"
                          onClick={() => onUseImage(img)}
                        >
                          <i className="fa-solid fa-rotate me-2"></i>
                          Use
                        </button>
                      </li>
                      <li style={{ fontSize: "14px" }}>
                        <button
                          className="dropdown-item"
                          type="button"
                          onClick={() => downloadImage(img?.id, "medium")}
                        >
                          <i className="fa-solid fa-download me-2"></i>
                          Download
                        </button>
                      </li>
                      <li style={{ fontSize: "14px" }}>
                        <button
                          className="dropdown-item text-danger"
                          type="button"
                          onClick={() => onDeleteImage(img?.id)}
                        >
                          <i className="fa-solid fa-trash me-2"></i>
                          Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      ) : loading ? (
        <div className="row g-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="col-md-4">
              <PlaceHolderCard />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="d-flex flex-column gap-2 justify-content-center align-items-center"
          style={{
            height: "40vh",
            width: "100%",
          }}
        >
          {list.length === 0 && !loading && (
            <div className="d-flex flex-column justify-content-center align-items-center gap-2 border border-info border-2 rounded-2 p-4">
              <i class="fa-solid fa-file-image fa-2xl mb-4 my-2 text-secondary"></i>
              <h4 className="fw-semibold text-secondary">
                No recent Image Found
              </h4>
              <button
                className="btn btn-outline-secondary mt-2"
                onClick={() => {
                  navigate("/studio");
                }}
              >
                <i className="fa-solid fa-image me-2"></i>
                Generate Image
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Previous;
