// frontend/src/App.jsx
import Player from "./pages/Player";
import AnimeDetails from "./pages/AnimeDetails";
import { Toaster } from "react-hot-toast";
import "./App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import SearchBar from "./components/SearchBar";
import WatchList from "./pages/WatchList";
import WatchListCategory from "./pages/WatchListCategory";
import ContinueWatching from "./pages/ContinueWatching";
import Settings from "./pages/Settings";

function NavBar() {
  const location = useLocation();

  const links = [
    { label: "Home", path: "/" },
    { label: "Watch List", path: "/watchlist" },
    { label: "Continue", path: "/continue" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1f1f1f",
        padding: "8px 24px",
        minHeight: "58px",
        flexWrap: "wrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
      }}
    >
      {/* Logo + Name */}
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          color: "white",
        }}
      >
        <img
          src="/logo.png"
          alt="Re:List"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            objectFit: "cover",
            display: "block",
          }}
        />
        <span
          style={{
            fontSize: "20px",
            fontWeight: "700",
            letterSpacing: "0.5px",
            background: "linear-gradient(90deg, #fff 0%, #c084fc 45%, #f43f5e 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          𝕽𝖊:𝕷𝖎𝖘𝖙
        </span>
      </Link>

      {/* Search */}
      <SearchBar />

      {/* Nav links */}
      <nav style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {links.map((link) => {
          const active =
            location.pathname === link.path ||
            (link.path !== "/" && location.pathname.startsWith(link.path));
          return (
            <Link
              key={link.path}
              to={link.path}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: active ? "600" : "500",
                color: active ? "white" : "#bbb",
                background: active
                  ? "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #f43f5e 100%)"
                  : "transparent",
                border: active ? "none" : "1px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white" }}>
        <Toaster
          position="bottom-right"
          toastOptions={{ style: { background: "#333", color: "#fff" } }}
        />
        <NavBar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/watchlist" element={<WatchList />} />
            <Route path="/watchlist/:category" element={<WatchListCategory />} />
            <Route path="/continue" element={<ContinueWatching />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/anime/:id" element={<AnimeDetails />} />
            <Route path="/player/:id/:episode" element={<Player />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;