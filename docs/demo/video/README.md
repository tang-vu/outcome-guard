# OutcomeGuard demo production

This directory contains the reproducible 2:35 judge-video timeline. Generated audio, browser captures, ASR reports, and exports are intentionally ignored because they may contain account-scoped API output or large binaries.

The integration follows Xiaomi's current official [MiMo V2.5 TTS guide](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis-v2.5) and [MiMo V2.5 ASR guide](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/Speech-Recognition). It uses built-in voice synthesis only; no voice clone or biometric sample is required.

## Truth boundary

- Live discovery is recorded from `https://outcomeguard.tangvu.dev` and labeled as a current Shannon read.
- Execution, settlement, and redemption are the real dedicated-test-agent lifecycle packaged under `docs/evidence/redemption-campaign-eec6`.
- The video never implies that the current live preview and the already-settled evidence are the same market window.
- No wallet seed, private key, API key, `.env` file, or browser account surface is recorded.

## Produce the cut

1. Rotate any API key ever pasted into chat or another transcript.
2. Store the replacement with Windows DPAPI, outside the repository:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/setup-mimo-key.ps1
   ```

3. Capture the real application journey:

   ```powershell
   npm run demo:validate
   npm run demo:capture
   ```

4. Generate MiMo V2.5 narration and run MiMo V2.5 ASR back-checking:

   ```powershell
   npm run demo:audio
   ```

5. Review every `REVIEW` item in `docs/demo/video/asr-report.json` by ear. Then render and inspect:

   ```powershell
   npm run demo:render
   npm run demo:inspect
   ```

The final local export is `docs/demo/video/outcomeguard-demo.mp4`. Public upload remains an explicit owner decision.
