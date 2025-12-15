import React, { useContext, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { userContext } from "../../../context/userContext";
import Spinner from "../../../components/Spinner";
import "../styling/gallery.css";

const Sidebar = ({
  activeTab,
  setActiveTab,
  loadingRecent,
  loadingRelated,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { relatedTotal, recentTotal } = useContext(userContext);

  useEffect(() => {
    const isGenerated = searchParams.has("generated-images");
    const isPrevious = searchParams.has("previous-images");
    const isRelated = searchParams.has("related-images");
    const tab = isGenerated
      ? "generated-images"
      : isPrevious
      ? "previous-images"
      : isRelated
      ? "related-images"
      : "unknown";
    setActiveTab(tab);
  }, [searchParams]);

  return (
    <aside
      className="bg-light border-end shadow-sm sidebar-filters d-flex flex-column"
      style={{
        width: "350px",
        position: "fixed",
        height: "81vh",
        overflowY: "auto",
      }}
    >
      <div className="d-flex justify-content-between align-items-center px-3 py-3 border-bottom">
        <div>
          <h6 className="mb-0 fw-bold">Nav Tabs</h6>
          <small className="text-muted">Navigate Different Images</small>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => {
            navigate("/studio");
          }}
        >
          <i className="fa-solid fa-arrow-left fa-sm me-2"></i>back
        </button>
      </div>

      <div
        className="px-3 py-3 flex-grow-1"
        style={{ overflow: "auto", minHeight: 0 }}
      >
        <nav className="sidebar nav-pills pe-4 ps-1">
          <div className="position-sticky">
            <ul className="nav flex-column gap-2">
              <li className="nav-item">
                <Link
                  to={"/gallery?generated-images"}
                  className={`nav-link ${
                    activeTab === "generated-images" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("generated-images")}
                >
                  Generated Images
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  to={"/gallery?previous-images"}
                  className={`nav-link d-flex justify-content-between align-items-center ${
                    activeTab === "previous-images" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("previous-images")}
                >
                  Previous Images{" "}
                  {loadingRecent && (
                    <Spinner type="grow" size="sm" color="secondary" />
                  )}
                  <span className="badge text-bg-secondary">{recentTotal}</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  to={"/gallery?related-images"}
                  className={`nav-link d-flex justify-content-between align-items-center ${
                    activeTab === "related-images" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("related-images")}
                >
                  Related Images{" "}
                  {loadingRelated && (
                    <Spinner type="grow" size="sm" color="secondary" />
                  )}
                  <span className="badge text-bg-secondary">
                    {relatedTotal}
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
