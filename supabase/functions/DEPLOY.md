# Edge Functions — CLI Deploy Reference

## Login

```bash
npx supabase login
```

## Deploy individual functions

```bash
npx supabase functions deploy pull-financial-data
```

```bash
npx supabase functions deploy trigger-financial-sync
```

```bash
npx supabase functions deploy pull-audit-data
```

```bash
npx supabase functions deploy trigger-audit-sync
```

## Deploy all at once

```bash
npx supabase functions deploy pull-financial-data trigger-financial-sync pull-audit-data trigger-audit-sync
```

## Notes

- Run `npx supabase login` once per machine; it stores the access token in your system keychain.
- Secrets (`GOOGLE_SA_KEY`, `APPSCRIPT_WEBHOOK_URL`, `APPSCRIPT_SECRET`) are set via the Supabase dashboard
  or `npx supabase secrets set KEY=value` — never commit them to the repo.
- `pull-financial-data` and `pull-audit-data` require `GOOGLE_SA_KEY`.
- `trigger-financial-sync` and `trigger-audit-sync` require `APPSCRIPT_WEBHOOK_URL` and `APPSCRIPT_SECRET`.
