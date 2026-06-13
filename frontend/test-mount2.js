import { renderToString } from 'react-dom/server';
import React from 'react';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

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

async function run() {
  const files = fs.readdirSync('./src/pages/admin-tabs').filter(f => f.endsWith('.tsx'));
  for (const file of files) {
    await testComp('./src/pages/admin-tabs/' + file, file);
  }
}

run();
