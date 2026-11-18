/** Registrerar @/-upplösningen innan testfilerna laddas. */
import { register } from "node:module";

register(new URL("./test-alias-hook.mjs", import.meta.url));
