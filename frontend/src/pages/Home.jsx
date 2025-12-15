import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// import "../App.css";
import "./styling/index.css";
import { userContext } from "../context/userContext";

const Home = (props) => {
  const { showAlert } = props.prop;
  const [animation, setAnimation] = useState(false);
  const navigate = useNavigate();
  const { fetchRecentImages, setRecentImages, setRecentTotal } =
    useContext(userContext);

  useEffect(() => {
    const initialise = async () => {
      try {
        const data = await fetchRecentImages();
        setRecentImages(data.items ?? (Array.isArray(data) ? data : []));
        setRecentTotal(data.total || (Array.isArray(data) ? data.length : 0));
      } catch (error) {
        console.warn("Failed to fetch recent images", error);
      }
    };

    initialise();
  }, []);

  const ICON = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="50"
      height="50"
      viewBox="0 0 64 64"
      fill="none"
    >
      <path
        d="M32 6 c-2.4 7.3-8.7 13.6-16 16 c7.3 2.4 13.6 8.7 16 16 c2.4-7.3 8.7-13.6 16-16 c-7.3-2.4-13.6-8.7-16-16z"
        fill="none"
        stroke="#7C3AED"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 10 v6 M47 13 h6"
        stroke="#7C3AED"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M14 44 v6 M11 47 h6"
        stroke="#7C3AED"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
  const handleNaviagate = (e) => {
    e.preventDefault();
    setAnimation(true);
    setTimeout(() => {
      navigate("/studio");
    }, [400]);
  };

  return (
    <div className="app-shell">
      <div className="hero-section d-flex align-items-center">
        <div
          className={`container pt-4 pb-5 animate__animated ${
            animation && "animate__zoomOut"
          }`}
          style={{ margin: "0 15%" }}
        >
          <div className="d-flex flex-column align-items-center text-center">
            {/* Logo + name */}
            <h1 className="fw-bold mb-3 animate" style={{ fontSize: "2.5rem" }}>
              {ICON} Imagine Luma
            </h1>

            {/* Main headline */}
            <h3
              className="fw-semibold mb-3 animate"
              style={{ fontSize: "2.25rem" }}
            >
              AI-Powered Design for Paperware
            </h3>

            {/* Description */}
            <p
              className="lead text-muted mb-5 animate"
              style={{ maxWidth: "700px" }}
            >
              Reimagine paperware with AI generate beautiful cups, plates, and
              napkins with curated styles, smart variations, and effortless one
              click enhancements
            </p>

            {/* Buttons */}
            <div className="d-flex flex-wrap justify-content-center gap-3 mb-5">
              <button
                className="btn btn-lg px-4 get-started-btn"
                smooth={true}
                duration={80}
                style={{ background: "#7C3AED", color: "white" }}
                onClick={handleNaviagate}
              >
                Get Started
              </button>
            </div>

            {/* Feature row */}
            <div className="row g-4 w-100 justify-content-center">
              <div className="col-12 col-md-4 text-center animate">
                <div className="mb-3">
                  <i
                    className="fa-solid fa-mug-hot fa-2xl"
                    style={{ color: "#7C3AED" }}
                  ></i>
                </div>
                <h5 className="fw-semibold mb-2">Cups</h5>
                <p className="text-muted mb-0">
                  Design beautiful coffee cups with AI.
                </p>
              </div>

              <div className="col-12 col-md-4 text-center animate">
                <div className="mb-3">
                  <i
                    className="fa-solid fa-utensils fa-2xl"
                    style={{ color: "#7C3AED" }}
                  ></i>
                </div>
                <h5 className="fw-semibold mb-2">Plates</h5>
                <p className="text-muted mb-0">
                  Create elegant dinnerware designs in minutes.
                </p>
              </div>

              <div className="col-12 col-md-4 text-center animate">
                <div className="mb-3">
                  <i
                    className="fa-regular fa-file-lines fa-2xl"
                    style={{ color: "#7C3AED" }}
                  ></i>
                </div>
                <h5 className="fw-semibold mb-2">Napkins</h5>
                <p className="text-muted mb-0">
                  Generate decorative napkin patterns effortlessly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
