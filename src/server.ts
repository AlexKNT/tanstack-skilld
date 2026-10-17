import entry from "@tanstack/react-start/server-entry";

// The site address is read at module load, so importing it here makes a
// missing or malformed `VITE_SITE_URL` fail as the server starts rather than
// on the first request.
import "#/features/seo/site";

export default entry;
