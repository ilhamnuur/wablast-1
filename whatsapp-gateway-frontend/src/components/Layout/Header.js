import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useApp } from "../../context/AppContext";

const Header = () => {
  const { currentUser, logout } = useAuth();
  const { activeTab, toggleSidebar } = useApp();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const getTabInfo = () => {
    const tabTitles = {
      session: {
        title: "Dashboard",
        subtitle: "Kelola sesi WhatsApp dan kirim pesan",
      },
      text: {
        title: "Kirim Pesan Teks",
        subtitle: "Kirim pesan teks ke nomor atau grup WhatsApp",
      },
      image: {
        title: "Kirim Gambar",
        subtitle: "Kirim gambar dengan caption ke WhatsApp",
      },
      document: {
        title: "Kirim Dokumen",
        subtitle: "Kirim dokumen file ke WhatsApp",
      },
      blast: {
        title: "Blast Pesan Biasa",
        subtitle: "Kirim pesan massal dengan template pintar",
      },
      "blast-custom": {
        title: "Blast Custom Excel",
        subtitle: "Blast custom dengan auto-detect Excel variables",
      },
      contacts: {
        title: "Manajemen Kontak & Group",
        subtitle: "Kelola daftar kontak, group dan import dari Excel",
      },
      debug: {
        title: "Debug Log",
        subtitle: "Lihat log debug sistem dan troubleshooting",
      },
    };

    return tabTitles[activeTab] || tabTitles.session;
  };

  const handleLogout = () => {
    if (window.confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
      logout();
      setUserDropdownOpen(false);
    }
  };

  const handleToggleSidebar = () => {
    toggleSidebar();
  };

  const tabInfo = getTabInfo();

  return (
    <div className="app-header px-6 py-4 sticky top-0 z-50">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Toggle Sidebar Button */}
          <button
            onClick={handleToggleSidebar}
            className="header-sidebar-toggle flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all lg:hidden"
            title="Toggle Sidebar"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>

          {/* Desktop Toggle - Always visible */}
          <button
            onClick={handleToggleSidebar}
            className="header-sidebar-toggle-desktop hidden lg:flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title="Toggle Sidebar"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>

          {/* Title Section */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {tabInfo.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tabInfo.subtitle}
            </p>
          </div>
        </div>

        <div className="user-menu">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center space-x-3 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 text-white rounded-xl flex items-center justify-center text-sm font-bold">
              <span>
                {currentUser.username?.charAt(0)?.toUpperCase() || "A"}
              </span>
            </div>
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </button>

          <div className={`user-dropdown ${userDropdownOpen ? "show" : ""}`}>
            <div className="dropdown-item border-b border-ultra-light mb-2">
              <div className="font-bold text-gray-900">
                {currentUser.username}
              </div>
              <div className="text-xs text-gray-500">
                Administrator
              </div>
            </div>
            
            <div
              className="dropdown-item-action text-red-600 font-semibold"
              onClick={handleLogout}
            >
              <svg
                className="w-4 h-4 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
              Keluar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
