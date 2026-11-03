# MineHost

Host a Minecraft Java server on an ARM64 Android phone. MineHost includes its own Java runtime. Use the app to start, restart, or stop the server, and use the dashboard to manage settings, files, add-ons, and backups.

[Download the latest APK](https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost.apk) · [Setup guide](https://adrighg-scripts.github.io/MineHost/) · [All releases](https://github.com/adrighg-scripts/MineHost/releases)

1. Install the APK on a phone running Android 8 or later with an ARM64 processor.
2. Open MineHost and select **Start setup**. Create a MineHost account and link the phone.
3. Pick a server engine and Minecraft version. Read and accept the Minecraft EULA before installing.
4. Start the server and join from Minecraft Java using the local address shown in the dashboard.
5. For players outside your Wi-Fi network, follow the router guide under **Help** and share the public address and external port.

**Paper** supports compatible plugins. **Fabric** supports mods and automatically installs Fabric API. You can also run **Vanilla** or **Pumpkin**. Pumpkin support in the current release does not include PatchBukkit.

Each profile has separate worlds, settings, and backups. One profile can run at a time. File uploads and deletions queued during play are applied when the server stops.

To update, stop the server so it saves the world, then install the latest APK over your existing MineHost app. The release also includes the Android project and the bundled runtimes' source archives.
