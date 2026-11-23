// Shared app state. app.js fills it before any view module loads; views import it from here.
export const state = {
  userId: null,
  profile: null, // { display_name } or null when the row is missing
  categories: [],
  catalog: [], // exercise_catalog rows, each with creator: { display_name } | null
  routines: [], // exercise_routines rows, each with creator
};

export const catalogById = () => new Map(state.catalog.map((e) => [e.id, e]));
