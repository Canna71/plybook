import { Color } from "chessops";
import { Component, useContext, createEffect, on, Show, ValidComponent } from "solid-js";
import { DOMElement } from "solid-js/types/jsx.js";
import { HierarchicalMoveData } from "../models/tree";
import { MovesContext } from "./Moves";
import { useContextMenu } from "./common/contextmenu";
import { Dynamic } from "solid-js/web";

const GoodMove = () => {
	return <svg xmlns="http://www.w3.org/2000/svg" class="" width="18" height="18" viewBox="0 0 18 19">
	<g id="great_find">
  <path class="icon-shadow" opacity="0.3" d="M9,.5a9,9,0,1,0,9,9A9,9,0,0,0,9,.5Z"></path>
  <path class="icon-background" fill="#749BBF" d="M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"></path>
  <g>
	<g class="icon-component-shadow" opacity="0.2">
	  <path d="M10.32,14.6a.27.27,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0H8l-.13,0-.11-.08a.41.41,0,0,1-.08-.24V12.7a.27.27,0,0,1,0-.13.36.36,0,0,1,.07-.1.39.39,0,0,1,.1-.08l.13,0h2a.31.31,0,0,1,.24.1.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13Zm-.12-3.93a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H8.1a.31.31,0,0,1-.34-.31L7.61,3.9a.36.36,0,0,1,.09-.24.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0h2.11a.32.32,0,0,1,.25.1.36.36,0,0,1,.09.24Z"></path>
	</g>
	<path class="icon-component" fill="#fff" d="M10.32,14.1a.27.27,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0H8l-.13,0-.11-.08a.41.41,0,0,1-.08-.24V12.2a.27.27,0,0,1,0-.13.36.36,0,0,1,.07-.1.39.39,0,0,1,.1-.08l.13,0h2a.31.31,0,0,1,.24.1.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13Zm-.12-3.93a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H8.1a.31.31,0,0,1-.34-.31L7.61,3.4a.36.36,0,0,1,.09-.24.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0h2.11a.32.32,0,0,1,.25.1.36.36,0,0,1,.09.24Z"></path>
  </g>
</g>
  </svg>;
}

const BadMove = () => {
	return <svg xmlns="http://www.w3.org/2000/svg" class="" width="18" height="18" viewBox="0 0 18 19">
	<g id="mistake">
  <g>
	<path class="icon-shadow" opacity="0.3" d="M9,.5a9,9,0,1,0,9,9A9,9,0,0,0,9,.5Z"></path>
	<path class="icon-background" fill="#FFA459" d="M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"></path>
  </g>
  <g>
	<g class="icon-component-shadow" opacity="0.2">
	  <path d="M9.92,15a.27.27,0,0,1,0,.12.41.41,0,0,1-.07.11.32.32,0,0,1-.23.09H7.7a.25.25,0,0,1-.12,0,.27.27,0,0,1-.1-.08A.31.31,0,0,1,7.39,15V13.19A.32.32,0,0,1,7.48,13l.1-.07.12,0H9.59a.32.32,0,0,1,.23.09.61.61,0,0,1,.07.1.28.28,0,0,1,0,.13Zm2.2-7.17a3.1,3.1,0,0,1-.36.73,5.58,5.58,0,0,1-.49.6,6,6,0,0,1-.52.49,8,8,0,0,0-.65.63,1,1,0,0,0-.27.7v.22a.24.24,0,0,1,0,.12.17.17,0,0,1-.06.1.3.3,0,0,1-.1.07l-.12,0H7.79l-.12,0a.3.3,0,0,1-.1-.07.26.26,0,0,1-.07-.1.37.37,0,0,1,0-.12v-.35A2.42,2.42,0,0,1,7.61,10a2.55,2.55,0,0,1,.33-.66,3.38,3.38,0,0,1,.45-.55c.16-.15.33-.29.49-.42a7.73,7.73,0,0,0,.64-.64,1,1,0,0,0,.26-.67.77.77,0,0,0-.07-.34.75.75,0,0,0-.23-.27,1.16,1.16,0,0,0-.72-.24,1.61,1.61,0,0,0-.49.07,3,3,0,0,0-.41.18,1.41,1.41,0,0,0-.29.18l-.11.09a.5.5,0,0,1-.24.06A.31.31,0,0,1,7,6.69L6,5.48a.29.29,0,0,1,0-.4,1.36,1.36,0,0,1,.21-.2,3.07,3.07,0,0,1,.56-.38,5.38,5.38,0,0,1,.89-.37A3.75,3.75,0,0,1,8.9,4a4.07,4.07,0,0,1,1.2.19,4,4,0,0,1,1.09.56,2.76,2.76,0,0,1,.78.92,2.82,2.82,0,0,1,.28,1.28A3,3,0,0,1,12.12,7.85Z"></path>
	</g>
	<path class="icon-component" fill="#fff" d="M9.92,14.52a.27.27,0,0,1,0,.12.41.41,0,0,1-.07.11.32.32,0,0,1-.23.09H7.7a.25.25,0,0,1-.12,0,.27.27,0,0,1-.1-.08.31.31,0,0,1-.09-.22V12.69a.32.32,0,0,1,.09-.23l.1-.07.12,0H9.59a.32.32,0,0,1,.23.09.61.61,0,0,1,.07.1.28.28,0,0,1,0,.13Zm2.2-7.17a3.1,3.1,0,0,1-.36.73,5.58,5.58,0,0,1-.49.6,6,6,0,0,1-.52.49,8,8,0,0,0-.65.63,1,1,0,0,0-.27.7v.22a.24.24,0,0,1,0,.12.17.17,0,0,1-.06.1.3.3,0,0,1-.1.07l-.12,0H7.79l-.12,0a.3.3,0,0,1-.1-.07.26.26,0,0,1-.07-.1.37.37,0,0,1,0-.12v-.35a2.42,2.42,0,0,1,.13-.84,2.55,2.55,0,0,1,.33-.66,3.38,3.38,0,0,1,.45-.55c.16-.15.33-.29.49-.42a7.73,7.73,0,0,0,.64-.64,1,1,0,0,0,.26-.67.77.77,0,0,0-.07-.34A.75.75,0,0,0,9.48,6a1.16,1.16,0,0,0-.72-.24,1.61,1.61,0,0,0-.49.07A3,3,0,0,0,7.86,6a1.41,1.41,0,0,0-.29.18l-.11.09a.5.5,0,0,1-.24.06A.31.31,0,0,1,7,6.19L6,5a.29.29,0,0,1,0-.4,1.36,1.36,0,0,1,.21-.2A3.07,3.07,0,0,1,6.81,4a5.38,5.38,0,0,1,.89-.37,3.75,3.75,0,0,1,1.2-.17,4.07,4.07,0,0,1,1.2.19,4,4,0,0,1,1.09.56,2.76,2.76,0,0,1,.78.92,2.82,2.82,0,0,1,.28,1.28A3,3,0,0,1,12.12,7.35Z"></path>
  </g>
</g>
  </svg>;
}

const Brilliant = () => {
	return <svg xmlns="http://www.w3.org/2000/svg" class="" width="18" height="18" viewBox="0 0 18 19">
	<g id="Brilliant">
  <path class="icon-shadow" opacity="0.3" d="M9,.5a9,9,0,1,0,9,9A9,9,0,0,0,9,.5Z"></path>
  <path class="icon-background" fill="#26c2a3" d="M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"></path>
  <g class="icon-component-shadow" opacity="0.2">
	<path d="M12.57,14.6a.51.51,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0h-2l-.13,0L10,14.84A.41.41,0,0,1,10,14.6V12.7a.32.32,0,0,1,.09-.23.39.39,0,0,1,.1-.08l.13,0h2a.31.31,0,0,1,.24.1.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13Zm-.12-3.93a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H10.35a.31.31,0,0,1-.34-.31L9.86,3.9A.36.36,0,0,1,10,3.66a.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0H12.3a.32.32,0,0,1,.25.1.36.36,0,0,1,.09.24Z"></path>
	<path d="M8.07,14.6a.51.51,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0h-2l-.13,0-.11-.08a.41.41,0,0,1-.08-.24V12.7a.27.27,0,0,1,0-.13.36.36,0,0,1,.07-.1.39.39,0,0,1,.1-.08l.13,0h2a.31.31,0,0,1,.24.1.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13ZM8,10.67a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H5.85a.31.31,0,0,1-.34-.31L5.36,3.9a.36.36,0,0,1,.09-.24.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0H7.8a.35.35,0,0,1,.25.1.36.36,0,0,1,.09.24Z"></path>
  </g>
  <g>
	<path class="icon-component" fill="#fff" d="M12.57,14.1a.51.51,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0h-2l-.13,0L10,14.34A.41.41,0,0,1,10,14.1V12.2A.32.32,0,0,1,10,12a.39.39,0,0,1,.1-.08l.13,0h2a.31.31,0,0,1,.24.1.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13Zm-.12-3.93a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H10.35a.31.31,0,0,1-.34-.31L9.86,3.4A.36.36,0,0,1,10,3.16a.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0H12.3a.32.32,0,0,1,.25.1.36.36,0,0,1,.09.24Z"></path>
	<path class="icon-component" fill="#fff" d="M8.07,14.1a.51.51,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0h-2l-.13,0-.11-.08a.41.41,0,0,1-.08-.24V12.2a.27.27,0,0,1,0-.13.36.36,0,0,1,.07-.1.39.39,0,0,1,.1-.08l.13,0h2A.31.31,0,0,1,8,12a.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13ZM8,10.17a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H5.85a.31.31,0,0,1-.34-.31L5.36,3.4a.36.36,0,0,1,.09-.24.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0H7.8a.35.35,0,0,1,.25.1.36.36,0,0,1,.09.24Z"></path>
  </g>
</g>
  </svg>;
}

const Blunder = () => {
	return <svg xmlns="http://www.w3.org/2000/svg" class="" width="18" height="18" viewBox="0 0 18 19">
	<g id="blunder">
  <path class="icon-shadow" opacity="0.3" d="M9,.5a9,9,0,1,0,9,9A9,9,0,0,0,9,.5Z"></path>
  <path class="icon-background" fill="#FA412D" d="M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"></path>
  <g class="icon-component-shadow" opacity="0.2">
	<path d="M14.74,5.45A2.58,2.58,0,0,0,14,4.54,3.76,3.76,0,0,0,12.89,4a4.07,4.07,0,0,0-1.2-.19A3.92,3.92,0,0,0,10.51,4a5.87,5.87,0,0,0-.9.37,3,3,0,0,0-.32.2,3.46,3.46,0,0,1,.42.63,3.29,3.29,0,0,1,.36,1.47.31.31,0,0,0,.19-.06l.11-.08a2.9,2.9,0,0,1,.29-.19,3.89,3.89,0,0,1,.41-.17,1.55,1.55,0,0,1,.48-.07,1.1,1.1,0,0,1,.72.24.72.72,0,0,1,.23.26.8.8,0,0,1,.07.34,1,1,0,0,1-.25.67,7.71,7.71,0,0,1-.65.63,6.2,6.2,0,0,0-.48.43,2.93,2.93,0,0,0-.45.54,2.55,2.55,0,0,0-.33.66,2.62,2.62,0,0,0-.13.83V11a.24.24,0,0,0,0,.12.35.35,0,0,0,.17.17l.12,0h1.71l.12,0a.23.23,0,0,0,.1-.07.21.21,0,0,0,.06-.1.27.27,0,0,0,0-.12V10.8a1,1,0,0,1,.26-.7q.27-.28.66-.63A5.79,5.79,0,0,0,14.05,9a4.51,4.51,0,0,0,.48-.6,2.56,2.56,0,0,0,.36-.72,2.81,2.81,0,0,0,.14-1A2.66,2.66,0,0,0,14.74,5.45Z"></path>
	<path d="M12.38,12.65H10.5l-.12,0a.34.34,0,0,0-.18.29v1.82a.36.36,0,0,0,.08.23.23.23,0,0,0,.1.07l.12,0h1.88a.24.24,0,0,0,.12,0,.26.26,0,0,0,.11-.07.36.36,0,0,0,.07-.1.28.28,0,0,0,0-.13V13a.27.27,0,0,0,0-.12.61.61,0,0,0-.07-.1A.32.32,0,0,0,12.38,12.65Z"></path>
	<path d="M6.79,12.65H4.91l-.12,0a.34.34,0,0,0-.18.29v1.82a.36.36,0,0,0,.08.23.23.23,0,0,0,.1.07l.12,0H6.79a.24.24,0,0,0,.12,0A.26.26,0,0,0,7,15a.36.36,0,0,0,.07-.1.28.28,0,0,0,0-.13V13a.27.27,0,0,0,0-.12.61.61,0,0,0-.07-.1A.32.32,0,0,0,6.79,12.65Z"></path>
	<path d="M8.39,4.54A3.76,3.76,0,0,0,7.3,4a4.07,4.07,0,0,0-1.2-.19A3.92,3.92,0,0,0,4.92,4a5.87,5.87,0,0,0-.9.37,3.37,3.37,0,0,0-.55.38l-.21.19a.32.32,0,0,0,0,.41l1,1.2a.26.26,0,0,0,.2.12.48.48,0,0,0,.24-.06l.11-.08a2.9,2.9,0,0,1,.29-.19l.4-.17A1.66,1.66,0,0,1,6,6.06a1.1,1.1,0,0,1,.72.24.72.72,0,0,1,.23.26A.77.77,0,0,1,7,6.9a1,1,0,0,1-.26.67,7.6,7.6,0,0,1-.64.63,6.28,6.28,0,0,0-.49.43,2.93,2.93,0,0,0-.45.54,2.72,2.72,0,0,0-.33.66,2.62,2.62,0,0,0-.13.83V11a.43.43,0,0,0,0,.12.39.39,0,0,0,.08.1.18.18,0,0,0,.1.07.21.21,0,0,0,.12,0H6.72l.12,0a.23.23,0,0,0,.1-.07.36.36,0,0,0,.07-.1A.5.5,0,0,0,7,11V10.8a1,1,0,0,1,.27-.7A8,8,0,0,1,8,9.47c.18-.15.35-.31.52-.48A7,7,0,0,0,9,8.39a3.23,3.23,0,0,0,.36-.72,3.07,3.07,0,0,0,.13-1,2.66,2.66,0,0,0-.29-1.27A2.58,2.58,0,0,0,8.39,4.54Z"></path>
  </g>
  <g>
	<path class="icon-component" fill="#fff" d="M14.74,5A2.58,2.58,0,0,0,14,4a3.76,3.76,0,0,0-1.09-.56,4.07,4.07,0,0,0-1.2-.19,3.92,3.92,0,0,0-1.18.17,5.87,5.87,0,0,0-.9.37,3,3,0,0,0-.32.2,3.46,3.46,0,0,1,.42.63,3.29,3.29,0,0,1,.36,1.47.31.31,0,0,0,.19-.06L10.37,6a2.9,2.9,0,0,1,.29-.19,3.89,3.89,0,0,1,.41-.17,1.55,1.55,0,0,1,.48-.07,1.1,1.1,0,0,1,.72.24.72.72,0,0,1,.23.26.8.8,0,0,1,.07.34,1,1,0,0,1-.25.67,7.71,7.71,0,0,1-.65.63,6.2,6.2,0,0,0-.48.43,2.93,2.93,0,0,0-.45.54,2.55,2.55,0,0,0-.33.66,2.62,2.62,0,0,0-.13.83v.35a.24.24,0,0,0,0,.12.35.35,0,0,0,.17.17l.12,0h1.71l.12,0a.23.23,0,0,0,.1-.07.21.21,0,0,0,.06-.1.27.27,0,0,0,0-.12V10.3a1,1,0,0,1,.26-.7q.27-.28.66-.63a5.79,5.79,0,0,0,.51-.48,4.51,4.51,0,0,0,.48-.6,2.56,2.56,0,0,0,.36-.72,2.81,2.81,0,0,0,.14-1A2.66,2.66,0,0,0,14.74,5Z"></path>
	<path class="icon-component" fill="#fff" d="M12.38,12.15H10.5l-.12,0a.34.34,0,0,0-.18.29v1.82a.36.36,0,0,0,.08.23.23.23,0,0,0,.1.07l.12,0h1.88a.24.24,0,0,0,.12,0,.26.26,0,0,0,.11-.07.36.36,0,0,0,.07-.1.28.28,0,0,0,0-.13V12.46a.27.27,0,0,0,0-.12.61.61,0,0,0-.07-.1A.32.32,0,0,0,12.38,12.15Z"></path>
	<path class="icon-component" fill="#fff" d="M6.79,12.15H4.91l-.12,0a.34.34,0,0,0-.18.29v1.82a.36.36,0,0,0,.08.23.23.23,0,0,0,.1.07l.12,0H6.79a.24.24,0,0,0,.12,0A.26.26,0,0,0,7,14.51a.36.36,0,0,0,.07-.1.28.28,0,0,0,0-.13V12.46a.27.27,0,0,0,0-.12.61.61,0,0,0-.07-.1A.32.32,0,0,0,6.79,12.15Z"></path>
	<path class="icon-component" fill="#fff" d="M8.39,4A3.76,3.76,0,0,0,7.3,3.48a4.07,4.07,0,0,0-1.2-.19,3.92,3.92,0,0,0-1.18.17,5.87,5.87,0,0,0-.9.37,3.37,3.37,0,0,0-.55.38l-.21.19a.32.32,0,0,0,0,.41l1,1.2a.26.26,0,0,0,.2.12.48.48,0,0,0,.24-.06L4.78,6a2.9,2.9,0,0,1,.29-.19l.4-.17A1.66,1.66,0,0,1,6,5.56a1.1,1.1,0,0,1,.72.24.72.72,0,0,1,.23.26A.77.77,0,0,1,7,6.4a1,1,0,0,1-.26.67,7.6,7.6,0,0,1-.64.63,6.28,6.28,0,0,0-.49.43,2.93,2.93,0,0,0-.45.54,2.72,2.72,0,0,0-.33.66,2.62,2.62,0,0,0-.13.83v.35a.43.43,0,0,0,0,.12.39.39,0,0,0,.08.1.18.18,0,0,0,.1.07.21.21,0,0,0,.12,0H6.72l.12,0a.23.23,0,0,0,.1-.07.36.36,0,0,0,.07-.1.5.5,0,0,0,0-.12V10.3a1,1,0,0,1,.27-.7A8,8,0,0,1,8,9c.18-.15.35-.31.52-.48A7,7,0,0,0,9,7.89a3.23,3.23,0,0,0,.36-.72,3.07,3.07,0,0,0,.13-1A2.66,2.66,0,0,0,9.15,5,2.58,2.58,0,0,0,8.39,4Z"></path>
  </g>
</g>
  </svg>;
}

const Interesting = () => {
	return <svg xmlns="http://www.w3.org/2000/svg" class="" width="18" height="18" viewBox="0 0 18 19">
	<g id="interesting">
  <path class="icon-shadow" d="m9 .5a9 9 0 1 0 9 9 9 9 0 0 0 -9-9z" opacity="0.3"></path>
  <path class="icon-background" d="m0 9a9 9 0 1 0 9-9 9 9 0 0 0 -9 9z" fill="#7979a1"></path>
  <g class="icon-component" opacity=".2">
	<path d="m4.75 12.9a.28.28 0 0 1 0-.13.25.25 0 0 1 .08-.1.33.33 0 0 1 .23-.1h2 .12l.11.08a.36.36 0 0 1 .07.1.59.59 0 0 1 0 .13v1.9a.36.36 0 0 1 -.09.24.27.27 0 0 1 -.1.08h-.13-2-.12a.44.44 0 0 1 -.19-.19.28.28 0 0 1 0-.13zm-.06-8.8a.41.41 0 0 1 .08-.24.35.35 0 0 1 .23-.1h2.14.13l.11.08a.5.5 0 0 1 .09.24l-.15 6.77c0 .21-.15.31-.34.31h-1.78a.3.3 0 0 1 -.2-.06.3.3 0 0 1 -.1-.1.31.31 0 0 1 0-.13z"></path><path d="m12.39 14.82a.25.25 0 0 1 0 .12.28.28 0 0 1 -.08.11l-.1.07h-.12-1.91a.27.27 0 0 1 -.13 0 .39.39 0 0 1 -.05-.12.35.35 0 0 1 -.08-.22v-1.78a.32.32 0 0 1 .09-.23l.1-.07h.12 1.89a.33.33 0 0 1 .23.09.61.61 0 0 1 .07.1.27.27 0 0 1 0 .13zm2.2-7.17a2.49 2.49 0 0 1 -.36.73 4.51 4.51 0 0 1 -.48.6 6 6 0 0 1 -.52.49q-.39.34-.66.63a1 1 0 0 0 -.27.7v.2a.22.22 0 0 1 0 .12.35.35 0 0 1 -.17.17.2.2 0 0 1 -.11 0h-1.75-.12a.23.23 0 0 1 -.1-.07.26.26 0 0 1 -.07-.1.22.22 0 0 1 .02-.12v-.35a2.41 2.41 0 0 1 .12-.84 2.91 2.91 0 0 1 .33-.66 3.38 3.38 0 0 1 .45-.55l.49-.42a6.55 6.55 0 0 0 .61-.62 1 1 0 0 0 .26-.67.66.66 0 0 0 -.08-.34.64.64 0 0 0 -.18-.27 1.18 1.18 0 0 0 -.77-.28 1.66 1.66 0 0 0 -.49.07 3 3 0 0 0 -.41.18 2.29 2.29 0 0 0 -.29.18l-.1.09a.53.53 0 0 1 -.24.06c-.12 0-.19-.07-.21-.13l-1-1.21a.29.29 0 0 1 0-.4 1.36 1.36 0 0 1 .21-.2 3 3 0 0 1 .55-.38 5.87 5.87 0 0 1 .9-.37 3.75 3.75 0 0 1 1.2-.17 4.12 4.12 0 0 1 1.2.19 4 4 0 0 1 1.09.56 2.73 2.73 0 0 1 .77.92 2.7 2.7 0 0 1 .29 1.28 2.72 2.72 0 0 1 -.11.98z"></path></g><g fill="#fff"><path d="m4.75 12.4a.28.28 0 0 1 0-.13.25.25 0 0 1 .08-.1.33.33 0 0 1 .23-.1h2 .12l.11.08a.36.36 0 0 1 .07.1.59.59 0 0 1 0 .13v1.9a.36.36 0 0 1 -.09.24.27.27 0 0 1 -.1.08h-.13-2-.12a.44.44 0 0 1 -.19-.19.28.28 0 0 1 0-.13zm-.06-8.8a.41.41 0 0 1 .08-.24.35.35 0 0 1 .23-.1h2.14.13l.11.08a.5.5 0 0 1 .09.24l-.15 6.77c0 .21-.15.31-.34.31h-1.78a.3.3 0 0 1 -.2-.06.3.3 0 0 1 -.07-.1.31.31 0 0 1 0-.13z"></path><path d="m12.39 14.32a.25.25 0 0 1 0 .12.28.28 0 0 1 -.08.11l-.1.07h-.12-1.91a.27.27 0 0 1 -.13 0 .39.39 0 0 1 -.1-.08.35.35 0 0 1 -.08-.22v-1.83a.32.32 0 0 1 .09-.23l.1-.07h.12 1.89a.33.33 0 0 1 .23.09.61.61 0 0 1 .07.1.27.27 0 0 1 0 .13zm2.2-7.17a2.49 2.49 0 0 1 -.36.73 4.51 4.51 0 0 1 -.48.6 6 6 0 0 1 -.52.49q-.39.34-.66.63a1 1 0 0 0 -.27.7v.22a.22.22 0 0 1 0 .12.35.35 0 0 1 -.17.17.2.2 0 0 1 -.11 0h-1.75-.12a.23.23 0 0 1 -.1-.07.26.26 0 0 1 -.07-.1.22.22 0 0 1 0-.12v-.35a2.41 2.41 0 0 1 .12-.84 2.91 2.91 0 0 1 .33-.66 3.38 3.38 0 0 1 .45-.55l.49-.42a6.55 6.55 0 0 0 .63-.64 1 1 0 0 0 .26-.67.66.66 0 0 0 -.08-.34.64.64 0 0 0 -.18-.27 1.18 1.18 0 0 0 -.73-.24 1.66 1.66 0 0 0 -.49.07 3 3 0 0 0 -.41.18 2.29 2.29 0 0 0 -.37.21l-.1.09a.53.53 0 0 1 -.24.06c-.12 0-.19-.07-.21-.13l-1-1.21a.29.29 0 0 1 0-.4 1.36 1.36 0 0 1 .21-.2 3 3 0 0 1 .55-.38 5.87 5.87 0 0 1 .9-.37 3.75 3.75 0 0 1 1.2-.17 4.12 4.12 0 0 1 1.2.19 4 4 0 0 1 1.16.52 2.73 2.73 0 0 1 .77.92 2.7 2.7 0 0 1 .29 1.28 2.72 2.72 0 0 1 -.14.95z"></path>
  </g>
</g>
  </svg>;
}

const Inaccuracy = () => {
	return <svg xmlns="http://www.w3.org/2000/svg" class="" width="18" height="18" viewBox="0 0 18 19">
	<g id="inaccuracy">
  <path class="icon-shadow" opacity="0.3" d="M9,.5a9,9,0,1,0,9,9A9,9,0,0,0,9,.5Z"></path>
  <path class="icon-background" fill="#F7C631" d="M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"></path>
  <g class="icon-component-shadow" opacity="0.2">
	<path d="M13.66,14.8a.28.28,0,0,1,0,.13.23.23,0,0,1-.08.11.28.28,0,0,1-.11.08l-.12,0h-2l-.13,0a.27.27,0,0,1-.1-.08A.36.36,0,0,1,11,14.8V12.9a.59.59,0,0,1,0-.13.36.36,0,0,1,.07-.1l.1-.08.13,0h2a.33.33,0,0,1,.23.1.39.39,0,0,1,.08.1.28.28,0,0,1,0,.13Zm-.12-3.93a.31.31,0,0,1,0,.13.3.3,0,0,1-.07.1.3.3,0,0,1-.23.08H11.43a.31.31,0,0,1-.34-.31L10.94,4.1A.5.5,0,0,1,11,3.86l.11-.08.13,0h2.11a.35.35,0,0,1,.26.1.41.41,0,0,1,.08.24Z"></path>
	<path d="M7.65,14.82a.27.27,0,0,1,0,.12.26.26,0,0,1-.07.11l-.1.07-.13,0H5.43a.25.25,0,0,1-.12,0,.27.27,0,0,1-.1-.08.31.31,0,0,1-.09-.22V13a.36.36,0,0,1,.09-.23l.1-.07.12,0H7.32a.32.32,0,0,1,.23.09.3.3,0,0,1,.07.1.28.28,0,0,1,0,.13Zm2.2-7.17a3.1,3.1,0,0,1-.36.73A5.58,5.58,0,0,1,9,9a4.85,4.85,0,0,1-.52.49,8,8,0,0,0-.65.63,1,1,0,0,0-.27.7V11a.21.21,0,0,1,0,.12.17.17,0,0,1-.06.1.23.23,0,0,1-.1.07l-.12,0H5.53a.21.21,0,0,1-.12,0,.18.18,0,0,1-.1-.07.2.2,0,0,1-.08-.1.37.37,0,0,1,0-.12v-.35a2.68,2.68,0,0,1,.13-.84,2.91,2.91,0,0,1,.33-.66,3.38,3.38,0,0,1,.45-.55c.16-.15.33-.29.49-.42a7.84,7.84,0,0,0,.65-.64,1,1,0,0,0,.25-.67.77.77,0,0,0-.07-.34.67.67,0,0,0-.23-.27A1.16,1.16,0,0,0,6.49,6,1.61,1.61,0,0,0,6,6.11a3,3,0,0,0-.41.18,1.75,1.75,0,0,0-.29.18l-.11.09A.5.5,0,0,1,5,6.62a.31.31,0,0,1-.21-.13l-1-1.21a.3.3,0,0,1,0-.4A1.36,1.36,0,0,1,4,4.68a3.07,3.07,0,0,1,.56-.38,5.49,5.49,0,0,1,.9-.37,3.69,3.69,0,0,1,1.19-.17,3.92,3.92,0,0,1,2.3.75,2.85,2.85,0,0,1,.77.92A2.82,2.82,0,0,1,10,6.71,3,3,0,0,1,9.85,7.65Z"></path>
  </g>
  <g>
	<path class="icon-component" fill="#fff" d="M13.66,14.3a.28.28,0,0,1,0,.13.23.23,0,0,1-.08.11.28.28,0,0,1-.11.08l-.12,0h-2l-.13,0a.27.27,0,0,1-.1-.08A.36.36,0,0,1,11,14.3V12.4a.59.59,0,0,1,0-.13.36.36,0,0,1,.07-.1l.1-.08.13,0h2a.33.33,0,0,1,.23.1.39.39,0,0,1,.08.1.28.28,0,0,1,0,.13Zm-.12-3.93a.31.31,0,0,1,0,.13.3.3,0,0,1-.07.1.3.3,0,0,1-.23.08H11.43a.31.31,0,0,1-.34-.31L10.94,3.6A.5.5,0,0,1,11,3.36l.11-.08.13,0h2.11a.35.35,0,0,1,.26.1.41.41,0,0,1,.08.24Z"></path>
	<path class="icon-component" fill="#fff" d="M7.65,14.32a.27.27,0,0,1,0,.12.26.26,0,0,1-.07.11l-.1.07-.13,0H5.43a.25.25,0,0,1-.12,0,.27.27,0,0,1-.1-.08.31.31,0,0,1-.09-.22V12.49a.36.36,0,0,1,.09-.23l.1-.07.12,0H7.32a.32.32,0,0,1,.23.09.3.3,0,0,1,.07.1.28.28,0,0,1,0,.13Zm2.2-7.17a3.1,3.1,0,0,1-.36.73,5.58,5.58,0,0,1-.49.6A4.85,4.85,0,0,1,8.48,9a8,8,0,0,0-.65.63,1,1,0,0,0-.27.7v.22a.21.21,0,0,1,0,.12.17.17,0,0,1-.06.1.23.23,0,0,1-.1.07l-.12,0H5.53a.21.21,0,0,1-.12,0,.18.18,0,0,1-.1-.07.2.2,0,0,1-.08-.1.37.37,0,0,1,0-.12v-.35a2.68,2.68,0,0,1,.13-.84,2.91,2.91,0,0,1,.33-.66,3.38,3.38,0,0,1,.45-.55c.16-.15.33-.29.49-.42a7.84,7.84,0,0,0,.65-.64,1,1,0,0,0,.25-.67.77.77,0,0,0-.07-.34.67.67,0,0,0-.23-.27,1.16,1.16,0,0,0-.72-.24A1.61,1.61,0,0,0,6,5.61a3,3,0,0,0-.41.18A1.75,1.75,0,0,0,5.3,6l-.11.09A.5.5,0,0,1,5,6.12.31.31,0,0,1,4.74,6l-1-1.21a.3.3,0,0,1,0-.4A1.36,1.36,0,0,1,4,4.18a3.07,3.07,0,0,1,.56-.38,5.49,5.49,0,0,1,.9-.37,3.69,3.69,0,0,1,1.19-.17A3.92,3.92,0,0,1,8.93,4a2.85,2.85,0,0,1,.77.92A2.82,2.82,0,0,1,10,6.21,3,3,0,0,1,9.85,7.15Z"></path>
  </g>
</g>
  </svg>;
}

const mainNags : ValidComponent[] = [GoodMove, GoodMove, BadMove, Brilliant, Blunder, Interesting, Inaccuracy];

type PlyProps = {
	line: HierarchicalMoveData;
	color?: Color;
};

const NagIcon : Component<{nag: number}> = ({nag}) => {
	return <span class="pgnviewer-annotation">
		<Dynamic component={mainNags[nag]!} />
	</span>;
}

// Function to return the chess annotation symbol
function getChessAnnotationSymbol(nag: number) {
    const symbols : Record<number,string> = {
        1: "!",          // good move
        2: "?",          // poor move
        3: "‼",         // very good
        4: "⁇",         // very poor
        5: "⁉",         // speculative move
        6: "⁈",         // questionable move
        7: "□",         // forced move
        8: "",          // singular move (no alts)
        9: "Worst move", // worst move
        10: "=",        // drawish pos or even
        11: "",         // eq chances, quiet pos
        12: "",         // eq chances, active pos
        13: "∞",        // unclear pos
        14: "⊕",        // W slight adv
        15: "⊖",        // B slight adv
        16: "±",        // W mod adv
        17: "∓",        // B mod adv
        18: "+−",       // W decisive adv
        19: "−+",       // B decisive adv
        20: "Crushing adv", // W crushing adv
        21: "Crushing adv", // B crushing adv
        22: "⨀",       // W is in zugzwang
        23: "⨀",       // B is in zugzwang
        24: "",        // W slight space adv
        25: "",        // B slight space adv
        26: "",        // W mod space adv
        27: "",        // B mod space adv
        28: "",        // W decisive space adv
        29: "",        // B decisive space adv
        30: "",        // W slight time/dev adv
        31: "",        // B slight time/dev adv
        32: "⟳",       // W mod time/dev adv
        33: "⟳",       // B mod time/dev adv
        34: "",        // W decisive time/dev adv
        35: "",        // B decisive time/dev adv
        36: "→",       // W has the initiative
        37: "→",       // B has the initiative
        38: "",        // W lasting initiative
        39: "",        // B lasting initiative
        40: "↑",       // W has the attack
        41: "↑",       // B has the attack
        42: "Compensation", // compensation
        48: "Center",  // center
        54: "K-side",  // K-side
        60: "Q-side",  // Q-side
        66: "1st rank", // 1st rank
        70: "King prot/placement", // king prot/placement
        78: "Pawn structure", // pawn structure
        86: "Piece placement", // piece placement (N->Q)
        102: "Piece coord", // piece coord
        106: "Opening play", // opening play
        114: "Middlegame play", // middlegame play
        122: "Endgame play", // endgame play
        130: "Counterplay", // counterplay
        136: "Time pressure", // time pressure
        140: "∆",       // With the idea...
        141: "Aimed against...",
        142: "⌓",      // Better is...
        143: "Worse is...",
        144: "Equivalent is...",
        145: "RR",      // Editorial comment
        146: "N",       // Novelty
        220: "Diagram", // Diagram
        221: "Diagram (from B)", // Diagram (from B)
        238: "Space Adv", // Space Adv
        239: "⇔",      // File (a-h)
        240: "⇗",      // Diagonal
        241: "Centre",  // Centre
        242: "⟫",      // King-side
        243: "⟪",      // Queen-side
        244: "✕",      // Weak point
        245: "⊥",      // Ending
        246: "Bishop pair", // Bishop pair
        247: "Opposite Bishops", // Opposite Bishops
        248: "Same Bishops", // Same Bishops
        249: "Connected pawns", // Connected pawns
        250: "Isolated pawns", // Isolated pawns
        251: "Doubled pawns", // Doubled pawns
        252: "Passed pawn", // Passed pawn
        253: "Pawn majority", // Pawn majority
        254: "With",    // With
        255: "Without"  // Without
    };

    return symbols[nag] || "Invalid number";
}

// Function to return the chess annotation description
function getChessDescription(nag: number) {
    const descriptions: Record<number,string> = {
        1: "Good move",
        2: "Poor move",
        3: "Very good",
        4: "Very poor",
        5: "Speculative move",
        6: "Questionable move",
        7: "Forced move",
        8: "Singular move (no alternatives)",
        9: "Worst move",
        10: "Drawish position or even",
        11: "Equal chances, quiet position",
        12: "Equal chances, active position",
        13: "Unclear position",
        14: "White slight advantage",
        15: "Black slight advantage",
        16: "White moderate advantage",
        17: "Black moderate advantage",
        18: "White decisive advantage",
        19: "Black decisive advantage",
        20: "White crushing advantage",
        21: "Black crushing advantage",
        22: "White is in zugzwang",
        23: "Black is in zugzwang",
        24: "White slight space advantage",
        25: "Black slight space advantage",
        26: "White moderate space advantage",
        27: "Black moderate space advantage",
        28: "White decisive space advantage",
        29: "Black decisive space advantage",
        30: "White slight time/development advantage",
        31: "Black slight time/development advantage",
        32: "White moderate time/development advantage",
        33: "Black moderate time/development advantage",
        34: "White decisive time/development advantage",
        35: "Black decisive time/development advantage",
        36: "White has the initiative",
        37: "Black has the initiative",
        38: "White lasting initiative",
        39: "Black lasting initiative",
        40: "White has the attack",
        41: "Black has the attack",
        42: "Compensation",
        48: "Center",
        54: "King-side",
        60: "Queen-side",
        66: "First rank",
        70: "King protection/placement",
        78: "Pawn structure",
        86: "Piece placement (Knight to Queen)",
        102: "Piece coordination",
        106: "Opening play",
        114: "Middlegame play",
        122: "Endgame play",
        130: "Counterplay",
        136: "Time pressure",
        140: "With the idea...",
        141: "Aimed against...",
        142: "Better is...",
        143: "Worse is...",
        144: "Equivalent is...",
        145: "Editorial comment",
        146: "Novelty",
        220: "Diagram",
        221: "Diagram (from B)",
        238: "Space advantage",
        239: "File (a-h)",
        240: "Diagonal",
        241: "Centre",
        242: "King-side",
        243: "Queen-side",
        244: "Weak point",
        245: "Ending",
        246: "Bishop pair",
        247: "Opposite Bishops",
        248: "Same Bishops",
        249: "Connected pawns",
        250: "Isolated pawns",
        251: "Doubled pawns",
        252: "Passed pawn",
        253: "Pawn majority",
        254: "With",
        255: "Without"
    };

    return descriptions[nag] || "Invalid number";
}


export const Ply: Component<PlyProps> = ({ line, color }) => {

	const turn = color;
	const plyData = color && line[color];
	let ref: HTMLDivElement | undefined;
	const { currentPath, showTooltip, editable, game, setGame } = useContext(MovesContext)!;

	const onAddComment = (before: boolean) => {
		const ng = game()?.insertComment(plyData?.path!, "", before);
		setGame(ng);
	}

	const onDelete = () => {
		const ng = game()?.deleteFrom(plyData?.path!);
		setGame(ng);
	}

	// context menu functions

	const onContextMenuInternal = useContextMenu({
		items: [
			{ id: "moves_comment_before", text: "Add Comment Before", action: () => onAddComment(true) },
			{ id: "moves_comment_after" , text: "Add Comment After", action: () => onAddComment(false) },
			{ id: "moves_delete", text: "Delete", action: onDelete },
		],
	});

	const onContextMenu = (e: MouseEvent) => {
		if(editable()) {
			onContextMenuInternal(e);
		}
	}


	const isCurrent = () => {
		return currentPath() && plyData?.path.equals(currentPath()!);
	};
	const isValid = () => {
		return plyData !== undefined;
	};

	const innerShowTooltip = (e: (MouseEvent & {
		currentTarget: HTMLDivElement;
		target: DOMElement;
	}) | undefined) => {
		if (e) {
			isValid() && !editable() && showTooltip(e.currentTarget, plyData);
		} else {
			showTooltip(undefined, undefined);
		}
	};

	const moveClass = () => {
		const cl = {
			"pgnviewer-move": isValid(),
			[turn + `-move`]: !!turn,
			"current-move": isCurrent()
		};
		const nag = mainNag();
		if(nag) {
			cl[`nag-${nag}`] = true;
		}
		return cl;
	};

	const mainNag = () => {
		// return 1-6 nags
		const nags = (plyData?.nags || []).filter(n => n >= 1 && n <= 6);
		if (nags.length === 0) return null;
		return nags[0];
	}

	const secondaryNags = () => {
		// return 7-9 nags
		const nags = (plyData?.nags || []).filter(n => n >= 7);
		if (nags.length === 0) return null;
		return nags[0];
	}

	const secondaryNagSymbol = () => {
		const nag = secondaryNags();
		if(nag) {
			return getChessAnnotationSymbol(nag);
		}
		return "";
	}

	createEffect(() => {
		if (isCurrent() && ref) {
			ref.scrollIntoView({ block: "nearest" });
		}
	});

	return <div
		ref={ref}
		onMouseEnter={innerShowTooltip}
		onMouseLeave={() => innerShowTooltip(undefined)}
		classList={moveClass()}
		data-color={color}
		data-path={color && line[color]?.path.path}
		onContextMenu={onContextMenu}
	>
		<Show when={mainNag()}><NagIcon nag={mainNag()!} /></Show>
		<span class="pgnviewer-movecontent" >{color && line[color]?.fan || "..."}{secondaryNagSymbol()}</span>
		

	</div>

	;
};
