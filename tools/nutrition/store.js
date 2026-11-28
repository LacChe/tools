// The only module that talks to Supabase. Returns plain rows, throws on error, never touches the DOM.
// Client queries never filter by user_id: the column default and row-level security handle it.

const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export function createStore(sb) {
  return {
    // Goal[] ascending by effective_from.
    async goals() {
      return check(await sb.from("nutrition_goals").select("effective_from, protein, fat, carbs").order("effective_from"));
    },
  };
}
