import { useContext, useEffect } from "react";
import "../App.css";
import { userContext } from "../context/userContext";
import Index from "./home/components/Index";

const Home = (props) => {
  const { showAlert } = props.prop;
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

  return (
    <div className="app-shell">
      <Index prop={{ showAlert }} />
    </div>
  );
};

export default Home;
