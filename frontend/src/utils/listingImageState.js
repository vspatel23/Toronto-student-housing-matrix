export const createListingImageState = (source) => ({
  source,
  isLoading: true,
  hasFailed: false,
  fallbackUnavailable: false,
});

export const listingImageStateReducer = (state, action) => {
  if (action.type === "reset") {
    return action.source === state.source
      ? state
      : createListingImageState(action.source);
  }

  const currentState =
    action.source === state.source
      ? state
      : createListingImageState(action.source);

  if (action.type === "load") {
    return {
      ...currentState,
      isLoading: false,
    };
  }

  if (action.type === "error") {
    if (currentState.hasFailed || action.isFallbackSource) {
      return {
        ...currentState,
        isLoading: false,
        fallbackUnavailable: true,
      };
    }

    return {
      ...currentState,
      isLoading: true,
      hasFailed: true,
    };
  }

  return currentState;
};
