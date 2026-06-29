package com.meroxio.expensemanager;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {
  @PluginMethod
  public void authenticate(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
      BiometricManager manager = BiometricManager.from(getContext());
      int status = manager.canAuthenticate(authenticators);

      if (status != BiometricManager.BIOMETRIC_SUCCESS) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("reason", "unavailable");
        call.resolve(result);
        return;
      }

      Executor executor = ContextCompat.getMainExecutor(getContext());
      BiometricPrompt prompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
        @Override
        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authResult) {
          JSObject result = new JSObject();
          result.put("ok", true);
          call.resolve(result);
        }

        @Override
        public void onAuthenticationError(int errorCode, CharSequence errString) {
          JSObject result = new JSObject();
          result.put("ok", false);
          result.put("reason", String.valueOf(errString));
          call.resolve(result);
        }

        @Override
        public void onAuthenticationFailed() {
          // The prompt remains active after a failed scan; wait for success or a terminal error.
        }
      });

      BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock MeroxIO")
        .setSubtitle("Use fingerprint, face unlock, device PIN, or password")
        .setAllowedAuthenticators(authenticators)
        .build();

      prompt.authenticate(promptInfo);
    });
  }
}
