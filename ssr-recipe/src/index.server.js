import React from "react";
import ReactDOMServer from "react-dom/server";
import express from "express";
import { StaticRouter } from "react-router-dom";
import App from "./App";
import path from "path";
import fs from "fs";
import { createStore, applyMiddleware } from "redux";
import { Provider } from "react-redux";
import thunk from "redux-thunk";
import createSagaMiddleware from "@redux-saga/core";
import rootReducer, { rootSaga } from "./modules";
import PreloadContext from "./lib/PreloadContext";
import { END } from "redux-saga";
import { ChunkExtractor, ChunkExtractorManager } from "@loadable/server";

const statsFile = path.resolve("./build/loadable-stats.json");

function createPage(root, tags) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1,shrink-to-fit=no"/>
      <meta name="theme-color" content="#000000" />
      <title>React App</title>
      ${tags.styles}
      ${tags.links}
    </hed>
    <body>
      <noscript>You need to enable Js to run this app.</noscript>
      <div id="root">
        ${root}
      </div>
      ${tags.scripts}
    </body>
  </html>`;
}

const app = express();

const serverRender = async (req, res, next) => {
  const context = {};
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(
    rootReducer,
    applyMiddleware(thunk, sagaMiddleware)
  );

  const sagaPromise = sagaMiddleware.run(rootSaga).toPromise();

  const preloadContext = {
    done: false,
    promises: [],
  };

  const extractor = new ChunkExtractor({ statsFile });

  const jsx = (
    <ChunkExtractorManager extractor={extractor}>
      <PreloadContext.Provider value={preloadContext}>
        <Provider store={store}>
          <StaticRouter location={req.url} context={context}>
            <App />
          </StaticRouter>
        </Provider>
      </PreloadContext.Provider>
    </ChunkExtractorManager>
  );

  // StaticMarkup - ????????? ???????????? ??????
  ReactDOMServer.renderToStaticMarkup(jsx);
  store.dispatch(END); // redux-saga??? END ????????? ??????????????? ????????? ?????????????????? ???????????? ?????? ??????
  try {
    await sagaPromise;
    await Promise.all(preloadContext.promises);
  } catch (e) {
    return res.status(500);
  }
  preloadContext.done = true;

  const root = ReactDOMServer.renderToString(jsx);

  // ?????? JS ?????? ????????? ?????? '<' ????????? ?????? ??????
  const stateString = JSON.stringify(store.getState()).replace(/</g, "\\u003c");
  // ????????? ?????? ????????? ??????????????? ??????
  const stateScript = `<sciprt__PRELOADED_STATE__ = ${stateString}</script`;

  const tags = {
    scripts: stateScript + extractor.getScriptTags(),
    links: extractor.getLinkTags(),
    styles: extractor.getStyleTags(),
  };

  res.send(createPage(root, tags));
};

const serve = express.static(path.resolve("./build"), {
  index: false,
});

// befor ServerRender
app.use(serve);

app.use(serverRender);

app.listen(5000, () => {
  console.log("Running on http://localhost:5000");
});
