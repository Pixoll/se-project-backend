# Software Engineering class project - Backend (API)

## Preparation

- Load `db.sql` into MySQL by running `mysql -u username -p < db.sql`.
- Run `cp .env.example .env` and fill out the database credentials.
    - Additionally, add the `PORT` variable to override the default port (`3000`)
      where the API will be attached.
- Install all dependencies with `npm i`.

## Execution

### `npm start`

Compiles and runs the API without live-reload.

### `npm run dev`

Runs the API with live-reload when any file inside `./src` changes,
or when `docs.yaml` is updated.
