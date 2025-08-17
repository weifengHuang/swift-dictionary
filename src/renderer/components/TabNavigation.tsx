import React from 'react';
import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { RoutesEnum } from '@renderer/constants';
import { useAtom } from 'jotai';
import { aiModeActiveAtom } from '@renderer/store';

interface TabNavigationProps {
  className?: string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [, setAiModeActive] = useAtom(aiModeActiveAtom);

  // Determine active tab based on current route
  const getActiveTab = () => {
    if (location.pathname === RoutesEnum.aiMode) {
      return 'ai';
    } else if (location.pathname === RoutesEnum.noteBook) {
      return 'notebook';
    } else {
      // Default to dictionary for home route
      return 'dictionary';
    }
  };

  const handleTabChange = (activeKey: string) => {
    switch (activeKey) {
      case 'ai':
        setAiModeActive(true);
        navigate(RoutesEnum.aiMode);
        break;
      case 'notebook':
        setAiModeActive(false);
        navigate(RoutesEnum.noteBook);
        break;
      case 'dictionary':
        setAiModeActive(false);
        navigate(RoutesEnum.dictionary);
        break;
      default:
        navigate(RoutesEnum.dictionary);
    }
  };

  const tabItems = [
    {
      key: 'ai',
      label: 'AI模式',
      children: <div />, // Content will be handled by router outlet
    },
    {
      key: 'dictionary',
      label: '词典',
      children: <div />,
    },
    {
      key: 'notebook',
      label: '生词本',
      children: <div />,
    },
  ];

  return (
    <div className={`tab-navigation-wrapper ${className || ''}`}>
      <Tabs
        activeKey={getActiveTab()}
        onChange={handleTabChange}
        className="custom-tabs"
        items={tabItems}
        size="large"
        type="card"
      />
    </div>
  );
};

export default TabNavigation;