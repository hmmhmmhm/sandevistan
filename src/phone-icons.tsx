import { Icon } from "@iconify/react";
import articleIcon from "@iconify-icons/pixelarticons/article";
import arrowDownIcon from "@iconify-icons/pixelarticons/arrow-down";
import arrowUpIcon from "@iconify-icons/pixelarticons/arrow-up";
import checklistIcon from "@iconify-icons/pixelarticons/checklist";
import checkboxIcon from "@iconify-icons/pixelarticons/checkbox";
import checkboxOnIcon from "@iconify-icons/pixelarticons/checkbox-on";
import chevronLeftIcon from "@iconify-icons/pixelarticons/chevron-left";
import cloudSunIcon from "@iconify-icons/pixelarticons/cloud-sun";
import debugIcon from "@iconify-icons/pixelarticons/debug";
import devicesIcon from "@iconify-icons/pixelarticons/devices";
import editIcon from "@iconify-icons/pixelarticons/edit";
import gridIcon from "@iconify-icons/pixelarticons/grid";
import mapIcon from "@iconify-icons/pixelarticons/map";
import messageIcon from "@iconify-icons/pixelarticons/message-processing";
import plusIcon from "@iconify-icons/pixelarticons/plus";
import reloadIcon from "@iconify-icons/pixelarticons/reload";
import textIcon from "@iconify-icons/pixelarticons/art-text";
import trashIcon from "@iconify-icons/pixelarticons/trash";
import githubIcon from "@iconify-icons/simple-icons/github";
import lockIcon from "@iconify-icons/pixelarticons/lock";

const ICONS = {
  article: articleIcon,
  arrowDown: arrowDownIcon,
  arrowUp: arrowUpIcon,
  checklist: checklistIcon,
  checkbox: checkboxOnIcon,
  checkboxOn: checkboxIcon,
  back: chevronLeftIcon,
  weather: cloudSunIcon,
  debug: debugIcon,
  devices: devicesIcon,
  edit: editIcon,
  layout: gridIcon,
  navigation: mapIcon,
  ai: messageIcon,
  plus: plusIcon,
  reload: reloadIcon,
  language: textIcon,
  trash: trashIcon,
  github: githubIcon,
  key: lockIcon,
} as const;

export type PhoneIconName = keyof typeof ICONS;

export function PhoneIcon({
  name,
  size = 28,
  className,
}: {
  readonly name: PhoneIconName;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <Icon
      icon={ICONS[name]}
      width={size}
      height={size}
      className={className}
      data-phone-icon={name}
      aria-hidden="true"
    />
  );
}
