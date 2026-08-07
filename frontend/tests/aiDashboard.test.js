import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import {
  createFrontendTestServer,
  installDom,
} from "./helpers/domHarness.js";

const AI_DESCRIPTION =
  "I want a furnished apartment near Toronto Metropolitan University, between $1200 and $1800, within 30 minutes, with WiFi and Laundry.";

const AI_FILTERS = {
  campus: "Toronto Metropolitan University",
  minRent: 1200,
  maxRent: 1800,
  housingType: "Apartment",
  maxCommute: 30,
  safetyLevel: null,
  furnished: "Furnished",
  amenities: ["WiFi", "Laundry"],
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const createSpy = (implementation = () => undefined) => {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return implementation(...args);
  };

  fn.calls = calls;
  return fn;
};

let React;
let act;
let render;
let cleanup;
let waitFor;
let userEvent;
let viteServer;
let restoreDom;
let AiSearchComposer;
let SearchForm;

before(async () => {
  restoreDom = installDom();

  ({ default: React } = await import("react"));
  ({ act, cleanup, render, waitFor } = await import("@testing-library/react"));
  ({ default: userEvent } = await import("@testing-library/user-event"));

  viteServer = await createFrontendTestServer();
  ({ default: AiSearchComposer } = await viteServer.ssrLoadModule(
    "/src/components/AiSearchComposer.jsx",
  ));
  ({ default: SearchForm } = await viteServer.ssrLoadModule(
    "/src/components/SearchForm.jsx",
  ));
});

afterEach(() => {
  cleanup?.();
});

after(async () => {
  await viteServer?.close();
  restoreDom?.();
});

const setupUser = () => userEvent.setup({ document: window.document });

const ComposerHarness = ({
  initialDescription = "",
  onSearch = createSpy(),
  requestFilters = async () => AI_FILTERS,
}) => {
  const [description, setDescription] = React.useState(initialDescription);

  return React.createElement(AiSearchComposer, {
    description,
    onDescriptionChange: setDescription,
    onSearch,
    requestFilters,
  });
};

const renderComposer = (overrides = {}) =>
  render(React.createElement(ComposerHarness, overrides));

const createSearchFormProps = (overrides = {}) => ({
  userName: "Ved Patel",
  campuses: [
    {
      _id: "campus-tmu",
      institution: "Toronto Metropolitan University",
      campusName: "Toronto Metropolitan University",
    },
  ],
  formData: {
    campus: "",
    housingType: "All types",
    minRent: 500,
    maxRent: 2000,
    maxCommute: 30,
    safetyLevel: "Any",
    furnished: "Any",
    amenities: [],
  },
  status: { type: "", message: "" },
  isSavingPreference: false,
  isSearchingListings: false,
  isLoadingCampuses: false,
  campusError: "",
  validationErrors: {},
  onFieldChange: createSpy(),
  onRentChange: createSpy(),
  onSubmit: (event) => event.preventDefault(),
  onClear: createSpy(),
  onRetryCampuses: createSpy(),
  aiSearchDescription: "",
  onAiSearchDescriptionChange: createSpy(),
  onAiSearch: createSpy(),
  requestAiFilters: async () => AI_FILTERS,
  recentSearches: [
    {
      _id: "search-1",
      campus: "Toronto Metropolitan University",
      housingType: "Apartment",
      minRent: 1200,
      maxRent: 1800,
      maxCommute: 30,
      createdAt: "2026-08-07T12:00:00.000Z",
    },
  ],
  isLoadingRecentSearches: false,
  ...overrides,
});

test("renders a labelled multiline description with example guidance and the 1500-character counter", () => {
  const view = renderComposer();
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  assert.equal(textarea.tagName, "TEXTAREA");
  assert.equal(textarea.getAttribute("rows"), "4");
  assert.equal(textarea.maxLength, 1500);
  assert.match(
    textarea.placeholder,
    /Example: I want a furnished apartment near Toronto Metropolitan University/i,
  );
  assert.ok(
    view.getByText(/Include details such as campus, monthly budget, commute/i),
  );
  assert.ok(view.getByText("0 / 1500"));
  assert.equal(
    view.getByRole("button", { name: "Search" }).disabled,
    true,
  );
});

test("blank and whitespace-only descriptions never call the AI request", async () => {
  const requestFilters = createSpy(async () => AI_FILTERS);
  const user = setupUser();
  const view = renderComposer({ requestFilters });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  await user.click(textarea);
  await user.keyboard("{Control>}{Enter}{/Control}");

  assert.equal(requestFilters.calls.length, 0);
  assert.match(
    view.getByRole("alert").textContent,
    /Enter a housing description before searching/i,
  );
  assert.equal(document.activeElement, textarea);

  await user.type(textarea, "   ");
  assert.match(
    view.getByRole("alert").textContent,
    /Enter more than spaces before searching/i,
  );
  await user.keyboard("{Control>}{Enter}{/Control}");

  assert.equal(requestFilters.calls.length, 0);
  assert.equal(view.getByRole("button", { name: "Search" }).disabled, true);
  assert.match(
    view.getByRole("alert").textContent,
    /Enter a housing description before searching/i,
  );
});

test("keeps the description visible and disables submission while extraction is running", async () => {
  const deferred = createDeferred();
  const requestFilters = createSpy(() => deferred.promise);
  const onSearch = createSpy(async () => undefined);
  const user = setupUser();
  const view = renderComposer({ requestFilters, onSearch });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  await user.type(textarea, AI_DESCRIPTION);
  const searchButton = view.getByRole("button", { name: "Search" });
  assert.equal(searchButton.disabled, false);

  await user.click(searchButton);

  assert.equal(requestFilters.calls.length, 1);
  assert.deepEqual(requestFilters.calls[0], [AI_DESCRIPTION]);
  assert.equal(textarea.value, AI_DESCRIPTION);
  assert.equal(textarea.readOnly, true);
  assert.equal(
    view.getByRole("button", { name: "Understanding…" }).disabled,
    true,
  );
  assert.equal(view.container.querySelector("form").getAttribute("aria-busy"), "true");
  const loadingStatus = view.getByText("Understanding your preferences…");
  assert.equal(loadingStatus.getAttribute("role"), "status");
  assert.equal(loadingStatus.getAttribute("aria-live"), "polite");

  await act(async () => {
    deferred.resolve(AI_FILTERS);
    await deferred.promise;
  });
  await waitFor(() => assert.equal(onSearch.calls.length, 1));
  assert.deepEqual(onSearch.calls[0], [
    { filters: AI_FILTERS, description: AI_DESCRIPTION },
  ]);
  assert.equal(textarea.value, AI_DESCRIPTION);
  assert.equal(view.queryByText("Review your search"), null);
});

test("starts listing search immediately after extraction without rendering a review screen", async () => {
  const requestFilters = createSpy(async () => AI_FILTERS);
  const onSearch = createSpy(async () => undefined);
  const user = setupUser();
  const view = renderComposer({ requestFilters, onSearch });

  await user.type(
    view.getByRole("textbox", { name: "Housing description" }),
    AI_DESCRIPTION,
  );
  await user.click(view.getByRole("button", { name: "Search" }));

  await waitFor(() => assert.equal(onSearch.calls.length, 1));
  assert.deepEqual(requestFilters.calls, [[AI_DESCRIPTION]]);
  assert.deepEqual(onSearch.calls[0], [
    { filters: AI_FILTERS, description: AI_DESCRIPTION },
  ]);
  assert.equal(view.queryByText("Review your search"), null);
  assert.equal(view.queryByRole("button", { name: "Confirm & Search" }), null);
  assert.equal(view.queryByRole("button", { name: "Edit description" }), null);
});

test("renders and edits an exact restored description without normalizing it", async () => {
  const exactDescription =
    "  I need a studio near OCAD.\nLaundry is essential.  ";
  const user = setupUser();
  const view = renderComposer({ initialDescription: exactDescription });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  assert.equal(textarea.value, exactDescription);
  await user.type(textarea, "More details");
  assert.equal(textarea.value, `${exactDescription}More details`);
});

test("a retryable failure preserves the description and Retry resubmits it", async () => {
  const timeoutError = Object.assign(new Error("request timed out"), {
    code: "AI_SERVICE_TIMEOUT",
  });
  let attempt = 0;
  const requestFilters = createSpy(async () => {
    attempt += 1;
    if (attempt === 1) {
      throw timeoutError;
    }
    return AI_FILTERS;
  });
  const onSearch = createSpy(async () => undefined);
  const user = setupUser();
  const view = renderComposer({ requestFilters, onSearch });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  await user.type(textarea, AI_DESCRIPTION);
  await user.click(view.getByRole("button", { name: "Search" }));

  const retryButton = await view.findByRole("button", { name: "Retry" });
  assert.equal(textarea.value, AI_DESCRIPTION);
  assert.match(
    view.getByRole("alert").textContent,
    /couldn't process your search right now/i,
  );
  assert.match(view.getByRole("alert").textContent, /description has been kept/i);
  assert.equal(requestFilters.calls.length, 1);

  await user.click(retryButton);
  await waitFor(() => assert.equal(onSearch.calls.length, 1));

  assert.equal(requestFilters.calls.length, 2);
  assert.deepEqual(requestFilters.calls, [
    [AI_DESCRIPTION],
    [AI_DESCRIPTION],
  ]);
  assert.deepEqual(onSearch.calls[0], [
    { filters: AI_FILTERS, description: AI_DESCRIPTION },
  ]);
  assert.equal(view.queryByText("Review your search"), null);
});

test("Advanced Search starts collapsed, reveals the shared manual controls, and keeps Recent Searches visible", async () => {
  const onFieldChange = createSpy();
  const onSubmit = createSpy((event) => event.preventDefault());
  const onClear = createSpy();
  const user = setupUser();
  const view = render(
    React.createElement(
      SearchForm,
      createSearchFormProps({ onFieldChange, onSubmit, onClear }),
    ),
  );
  const advancedToggle = view.getByRole("button", {
    name: "Advanced Search",
  });

  assert.equal(advancedToggle.getAttribute("aria-expanded"), "false");
  assert.equal(view.queryByRole("combobox", { name: "Campus" }), null);
  assert.ok(view.getByRole("heading", { name: "Recent Searches" }));
  assert.ok(view.getByText("Toronto Metropolitan University"));
  assert.equal(view.queryByText(/Saved Preferences/i), null);

  await user.click(advancedToggle);

  assert.equal(advancedToggle.getAttribute("aria-expanded"), "true");
  assert.ok(view.getByRole("region", { name: "Advanced Search" }));
  const campusSelect = view.getByRole("combobox", { name: "Campus" });
  const housingTypeSelect = view.getByRole("combobox", {
    name: "Housing type",
  });
  assert.ok(view.getByRole("combobox", { name: "Furnishing" }));
  assert.ok(view.getByRole("group", { name: "Minimum safety level" }));
  assert.ok(view.getByRole("group", { name: "Monthly rent range" }));
  assert.ok(view.getByRole("group", { name: "Maximum TTC commute" }));
  assert.ok(view.getByRole("group", { name: "Amenities" }));

  await user.selectOptions(campusSelect, "Toronto Metropolitan University");
  await user.selectOptions(housingTypeSelect, "Apartment");
  await user.click(view.getByRole("checkbox", { name: "WiFi" }));
  assert.deepEqual(onFieldChange.calls, [
    ["campus", "Toronto Metropolitan University"],
    ["housingType", "Apartment"],
    ["amenities", ["WiFi"]],
  ]);

  await user.click(view.getByRole("button", { name: "Search listings" }));
  await user.click(view.getByRole("button", { name: "Clear filters" }));
  assert.equal(onSubmit.calls.length, 1);
  assert.equal(onClear.calls.length, 1);
  assert.ok(view.getByRole("heading", { name: "Recent Searches" }));
});

test("plain Enter remains available for multiline descriptions without submitting", async () => {
  const requestFilters = createSpy(async () => AI_FILTERS);
  const user = setupUser();
  const view = renderComposer({ requestFilters });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  await user.type(textarea, "Near TMU{Enter}With laundry");

  assert.equal(textarea.value, "Near TMU\nWith laundry");
  assert.equal(requestFilters.calls.length, 0);
  assert.ok(view.getByRole("button", { name: "Search" }));
});

test("Ctrl+Enter submits an eligible description", async () => {
  const requestFilters = createSpy(async () => AI_FILTERS);
  const onSearch = createSpy(async () => undefined);
  const user = setupUser();
  const view = renderComposer({ requestFilters, onSearch });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  await user.type(textarea, "Apartment near TMU");
  await user.keyboard("{Control>}{Enter}{/Control}");

  await waitFor(() => assert.equal(onSearch.calls.length, 1));
  assert.deepEqual(requestFilters.calls, [["Apartment near TMU"]]);
  assert.deepEqual(onSearch.calls[0], [
    { filters: AI_FILTERS, description: "Apartment near TMU" },
  ]);
});

test("Meta+Enter submits an eligible description", async () => {
  const requestFilters = createSpy(async () => AI_FILTERS);
  const onSearch = createSpy(async () => undefined);
  const user = setupUser();
  const view = renderComposer({ requestFilters, onSearch });
  const textarea = view.getByRole("textbox", { name: "Housing description" });

  await user.type(textarea, "Furnished room near campus");
  await user.keyboard("{Meta>}{Enter}{/Meta}");

  await waitFor(() => assert.equal(onSearch.calls.length, 1));
  assert.deepEqual(requestFilters.calls, [["Furnished room near campus"]]);
  assert.deepEqual(onSearch.calls[0], [
    { filters: AI_FILTERS, description: "Furnished room near campus" },
  ]);
});
