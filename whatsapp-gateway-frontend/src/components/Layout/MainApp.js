import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Dashboard from "../Dashboard/Dashboard";
import TextMessage from "../Messages/TextMessage";
import ImageMessage from "../Messages/ImageMessage";
import DocumentMessage from "../Messages/DocumentMessage";
import RegularBlast from "../Blast/RegularBlast";
import CustomBlast from "../Blast/CustomBlast";
import ContactManagement from "../Contacts/ContactManagement";
import ScheduledMessages from "../Automation/ScheduledMessages";
import AutoReply from "../Automation/AutoReply";
import DebugLog from "../Debug/DebugLog";
import BlastResults from "../Blast/BlastResults";
import StatusMessage from "../Common/StatusMessage";
import { useApp } from "../../context/AppContext";

const MainApp = () => {
  const { activeTab, sidebarOpen, closeSidebar } = useApp();

  const renderContent = () => {
    switch (activeTab) {
      case "session":
        return <Dashboard />;
      case "text":
        return <TextMessage />;
      case "image":
        return <ImageMessage />;
      case "document":
        return <DocumentMessage />;
      case "blast":
        return <RegularBlast />;
      case "blast-custom":
        return <CustomBlast />;
      case "scheduled":
        return <ScheduledMessages />;
      case "autoreply":
        return <AutoReply />;
      case "contacts":
        return <ContactManagement />;
      case "debug":
        return <DebugLog />;
      default:
        return <Dashboard />;
    }
  };

  const handleOverlayClick = () => {
    closeSidebar();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        id="mobileOverlay"
        className="mobile-overlay"
        onClick={handleOverlayClick}
      ></div>

      <Sidebar />

      <div
        className={`main-content ${
          !sidebarOpen ? "main-content-expanded" : ""
        }`}
      >
        <Header />

        <div className="p-6">
          {renderContent()}
          <BlastResults />
          <StatusMessage />
        </div>
      </div>
    </>
  );
};

export default MainApp;
