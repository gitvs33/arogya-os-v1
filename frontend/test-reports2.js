import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

import React from 'react';
import { renderToString } from 'react-dom/server';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsAnalytics from './src/pages/ReportsAnalytics.tsx';

const queryClient = new QueryClient();

try {
  const html = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        BrowserRouter,
        null,
        React.createElement(ReportsAnalytics)
      )
    )
  );
  console.log("Render successful! Length:", html.length);
} catch (e) {
  console.error("Render failed!");
  console.error(e.message);
  console.error(e.stack);
}
