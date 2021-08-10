const loggerMiddleware = store => next => action => {
  console.group(action && action.type); // 액션 타입으로 로그 그룹화
  console.log("이전 상태", store.getState());
  console.log("액션", action);

  next(action); // 미들웨어 혹은 리듀서에 전달

  console.log("다음 상태", store.getState());
  console.groupEnd();
};

export default loggerMiddleware;
