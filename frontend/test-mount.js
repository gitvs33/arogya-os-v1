import { renderToString } from 'react-dom/server';
import React from 'react';

// Setup fake browser env before importing components
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

async function testComp(pathName, name) {
  try {
    const mod = await import(pathName);
    const Comp = mod.default;
    renderToString(
      React.createElement(QueryClientProvider, { client: queryClient }, 
        React.createElement(Comp)
      )
    );
    console.log(`${name} OK`);
  } catch (e) {
    console.log(`Error in ${name}:`, e.message);
  }
}

// Ensure babel registers tsx or use vite-node to execute this.
// Actually, it's a tsx file, so node can't run it natively. We need ts-node or vite-node.
