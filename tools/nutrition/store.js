// The only module that talks to Supabase. Returns plain rows, throws on error, never touches the DOM.
// Client queries never filter by user_id: the column default and row-level security handle it.

const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export function createStore(sb) {
  return {
    // Goal[] ascending by effective_from.
    async goals() {
      return check(await sb.from("nutrition_goals").select("effective_from, protein, fat, carbs").order("effective_from"));
    },

    // Upsert on (user_id, effective_from): a second save for the same date replaces the first.
    async addGoal({ effective_from, protein, fat, carbs }) {
      return check(await sb.from("nutrition_goals")
        .upsert({ effective_from, protein, fat, carbs }, { onConflict: "user_id,effective_from" })
        .select("effective_from, protein, fat, carbs").single());
    },
  };
}
