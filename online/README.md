# Online leaderboard

The game keeps a leaderboard in each browser. With a Supabase project it also shares one online: every driver's
best per stage and car, for everyone.

1. Create a free project at https://supabase.com (sign in with GitHub works).
2. In the project, open **SQL Editor**, paste `supabase.sql` and run it.
3. In **Project Settings → API Keys** copy the **Project URL** and the **publishable** (or legacy **anon public**) key.
   That key is public by design: it ships inside the page, and the policies in `supabase.sql` only let it read times
   and add new ones. Never put the **secret** / **service_role** key in the game.
4. Put both in `ONLINE` at the top of the leaderboard section in `src/game.js`, build and push.

Rows can't be edited or deleted from the game. To remove a bogus time, delete it in Supabase's Table Editor.
