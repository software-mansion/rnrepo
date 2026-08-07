package org.rnrepo.tools.prebuilds

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class FallbackPackagesTest {
    private fun pkg(name: String) = PackageItem(name = name, version = "1.0.0", npmName = name)

    @Test
    fun `isEmpty is true only before any package is added`() {
        val fallback = FallbackPackages()
        assertThat(fallback.isEmpty()).isTrue()

        fallback.add(FallbackReason.DENIED, pkg("expo-camera"))
        assertThat(fallback.isEmpty()).isFalse()
    }

    @Test
    fun `packages are grouped under the reason they were added with`() {
        val fallback = FallbackPackages()
        val denied = pkg("expo-camera")
        val unavailable = pkg("react-native-svg")
        fallback.add(FallbackReason.DENIED, denied, "deny list")
        fallback.add(FallbackReason.UNAVAILABLE, unavailable)

        assertThat(fallback.get(FallbackReason.DENIED)).containsOnlyKeys(denied)
        assertThat(fallback.get(FallbackReason.DENIED)[denied]).isEqualTo("deny list")
        assertThat(fallback.get(FallbackReason.UNAVAILABLE)).containsOnlyKeys(unavailable)
        assertThat(fallback.get(FallbackReason.INCOMPATIBLE)).isEmpty()
        assertThat(fallback.get(FallbackReason.DEPENDENCY)).isEmpty()
    }

    @Test
    fun `addAll stores the same detail for every package`() {
        val fallback = FallbackPackages()
        val packages = listOf(pkg("react-native-reanimated"), pkg("expensify_react-native-live-markdown"))
        fallback.addAll(FallbackReason.DEPENDENCY, packages, "depends on react-native-worklets")

        assertThat(fallback.get(FallbackReason.DEPENDENCY).values)
            .containsOnly("depends on react-native-worklets")
        assertThat(fallback.get(FallbackReason.DEPENDENCY)).hasSize(2)
    }

    @Test
    fun `re-adding a package replaces its detail without duplicating the entry`() {
        val fallback = FallbackPackages()
        val item = pkg("react-native-reanimated")
        fallback.add(FallbackReason.DEPENDENCY, item, "depends on react-native-worklets")
        fallback.add(FallbackReason.DEPENDENCY, item, "depends on react-native-firebase_app")

        assertThat(fallback.get(FallbackReason.DEPENDENCY)).hasSize(1)
        assertThat(fallback.get(FallbackReason.DEPENDENCY)[item])
            .isEqualTo("depends on react-native-firebase_app")
    }
}
