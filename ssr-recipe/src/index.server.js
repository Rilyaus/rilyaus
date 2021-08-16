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

const manifest = JSON.parse(
  fs.readFileSync(path.resolve("./build/asset-manifest.json"), "utf8")
);

const chunks = Object.keys(manifest.files)
  .filter(key => /chunk\.js$/.exec(key))
  .map(key => `<script src="${manifest.files[key]}"></script>`)
  .join("");

function createPage(root, stateScript) {
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
      <link href="${manifest.files["main.css"]}" rel="stylesheet" />
    </hed>
    <body>
      <noscript>You need to enable Js to run this app.</noscript>
      <div id="root">
        ${root}
      </div>
      ${stateScript}
      <script src="${manifest.files["runtime-main.js"]}"></script>
      ${chunks}
      <sciprt src="${manifest.files["main.js"]}"></sciprt>
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
  const jsx = (
    <PreloadContext.Provider value={preloadContext}>
      <Provider store={store}>
        <StaticRouter location={req.url} context={context}>
          <App />
        </StaticRouter>
      </Provider>
    </PreloadContext.Provider>
  );

  // StaticMarkup - 정적인 페이지를 생성
  ReactDOMServer.renderToStaticMarkup(jsx);
  store.dispatch(END); // redux-saga의 END 액션을 발생시키면 액션을 모니터링하는 사가들이 모두 종료
  try {
    await sagaPromise;
    await Promise.all(preloadContext.promises);
  } catch (e) {
    return res.status(500);
  }
  preloadContext.done = true;

  const root = ReactDOMServer.renderToString(jsx);

  // 악성 JS 실행 방지를 위한 '<' 문자열 치환 처리
  const stateString = JSON.stringify(store.getState()).replace(/</g, "\\u003c");
  // 리덕스 초기 상태를 스크립트로 주입
  const stateScript = `<sciprt__PRELOADED_STATE__ = ${stateString}</script`;

  res.send(createPage(root, stateScript));
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
