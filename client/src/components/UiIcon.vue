<script setup lang="ts">
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  DatabaseBackup,
  Ellipsis,
  Eye,
  EyeOff,
  HardDrive,
  History,
  Image,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Tractor,
  User,
  Users,
  WifiOff,
  X,
} from "lucide-vue-next";

const icons = {
  "arrow-down-left": ArrowDownLeft,
  "arrow-up-right": ArrowUpRight,
  camera: Camera,
  chart: ChartNoAxesCombined,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "database-backup": DatabaseBackup,
  ellipsis: Ellipsis,
  eye: Eye,
  "eye-off": EyeOff,
  "hard-drive": HardDrive,
  history: History,
  image: Image,
  info: Info,
  dashboard: LayoutDashboard,
  "log-in": LogIn,
  "log-out": LogOut,
  package: Package,
  plus: Plus,
  "qr-code": QrCode,
  refresh: RefreshCw,
  save: Save,
  search: Search,
  tractor: Tractor,
  user: User,
  users: Users,
  "wifi-off": WifiOff,
  x: X,
} as const;

withDefaults(defineProps<{ name: keyof typeof icons; size?: number }>(), {
  size: 16,
});
</script>

<template>
  <component
    :is="icons[name]"
    :size="size"
    :stroke-width="1.75"
    aria-hidden="true"
    focusable="false"
  />
</template>
