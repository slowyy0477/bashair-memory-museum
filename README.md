# Private memory room

Only encrypted content is hosted here. The decryption key belongs in the private invitation URL fragment, never in this repository. Anyone given the complete link can open the room. This is link-based access, not account authentication.

## Install and reopen

Serve the shell and ciphertext together at a dedicated HTTPS directory URL. GitHub Pages project paths on the same hostname are not separate origins; use a dedicated origin if other apps on the hostname are not trusted. On Android, use the gate's **Install app** button or the browser menu. On iPhone, open Safari's **Share > Add to Home Screen**, enable **Open as Web App**, and tap **Add**.

The installed app starts locked. Keep the original private invitation and paste its complete URL (for this same app) or its exact fragment into the gate. The gate never saves the key. The registered worker embeds the trusted shell, so CacheStorage cannot replace it; only the verified encrypted collection is written to CacheStorage. Once the worker is installed and the encrypted collection is cached, the invitation works offline. Installing alone does not download the collection; open it online inside the installed app first, because its storage may differ from the browser's. Clearing or losing browser storage means another online opening is needed.
