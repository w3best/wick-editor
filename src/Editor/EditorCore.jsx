/*
 * Copyright 2020 WICKLETS LLC
 *
 * This file is part of Wick Editor.
 *
 * Wick Editor is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wick Editor is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wick Editor.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Component } from 'react';
import * as urlParse from 'url-parse/dist/url-parse';
import queryString from 'query-string';
import { saveAs } from 'file-saver';
import VideoExport from './export/VideoExport';
import GIFExport from './export/GIFExport';
import GIFImport from './import/GIFImport';
import AudioExport from './export/AudioExport';
import timeStamp from './Util/DataFunctions/timestamp';

class EditorCore extends Component {

  /**
   * Returns the name of the active tool.
   * @returns {string} The string representation active tool name.
   */
  getActiveTool = () => {
    return this.project.activeTool;
  }

  /**
   * Change the active tool.
   * @param {string} newTool - The string representation of the tool to switch to.
   */
  setActiveTool = (newTool) => {
    if(newTool !== this.getActiveTool().name) {
      this.lastUsedTool = this.getActiveTool();
      this.project.activeTool = newTool;

      this._onEyedropperPickedColor = (color) => {
        this.project.toolSettings.setSetting('fillColor', new window.Wick.Color(color));
      };

      // We must manually close the brush modes popup here, because otherwise the page
      // will crash because the popup can no longer find the brush modes toggle button
      // on the page.
      // See: https://github.com/reactstrap/reactstrap/issues/894
      this.toggleBrushModes(false);

      this.projectDidChange({ actionName: "Set Active Tool: " + newTool });
    }
  }

  /**
   * Toggles highlighted clip borders.
   */
  toggleClipBorders = () => {
    this.project.showClipBorders = !this.project.showClipBorders;
    this.projectDidChange({ actionName: "Toggle Clip Borders"});
  }

  /**
   * Activates the tool that was used before the current tool was activated.
   */
  activateLastTool = () => {
    this.project.activeTool = this.lastUsedTool;
    this.projectDidChange({ actionName: "Activate Last Tool" });
  }

  /**
   * Undo the last action that was done.
   */
  undoAction = () => {
    if(!this.project.undo()) {
      this.toast('Nothing to undo.', 'warning');
    } else {
      this.projectDidChange({ skipHistory:true, actionName: "Undo" });
    }
  }

  /**
   * Recover the state of the project from before the last action was done.
   */
  redoAction = () => {
    if(!this.project.redo()) {
      this.toast('Nothing to redo.', 'warning');
    } else {
      this.projectDidChange({skipHistory:true, actionName: "Redo" });
    }
  }

  /**
   * Recenters the canvas.
   */
  recenterCanvas = () => {
    this.project.recenter();
    this.projectDidChange( { skipHistory: true, actionName: "recenterCanvas"} );
  }

  /**
   * Zooms in the canvas.
   */
  zoomIn = () => {
    this.project.zoomIn();
    this.project.view.render();
  }

  /**
   * Zooms out the canvas.
   */
  zoomOut = () => {
    this.project.zoomOut();
    this.project.view.render();
  }

  /**
   * Returns an object containing the tool settings.
   * @returns {object} The object containing the tool settings.
   */
  getToolSetting = (name) => {
    return this.project.toolSettings.getSetting(name);
  }

  /**
   * Updates the tool settings state.
   * @param {object} newToolSettings - An object of key-value pairs where the keys represent tool settings and the values represent the values to change those settings to.
   */
  setToolSetting = (name, value) => {
    this.project.toolSettings.setSetting(name, value);
    this.projectDidChange({actionName: "Change Tool Setting " + name + ":" + value });
  }

  /**
   *
   */
  getToolSettingRestrictions = (name) => {
      return this.project.toolSettings.getSettingRestrictions(name);
  }

  /**
   * Returns all animation types available
   * @returns {Object[]} - Animation types listed as objects with label and value keys.
   */
  getClipAnimationTypes = () => {
    let outputTypes = [];
    Object.keys(window.Wick.Clip.animationTypes).forEach(key => {
      outputTypes.push({label: window.Wick.Clip.animationTypes[key], value: key});
    });
    return outputTypes;
  }

  /**
   * Shrinks the brush/eraser size by a given amount.
   */
  changeBrushSize = (amt) => {
    var tool = this.project.activeTool.name
    var option;
    if(tool === 'brush') {
        option = 'brushSize';
    } else if (tool === 'eraser') {
        option = 'eraserSize';
    } else {
        return;
    }

    let brushSize = this.getToolSetting(option);
    let newBrushSize = brushSize += amt;

    this.setToolSetting(option, newBrushSize);
  }

  /**
   * Moves the active timeline's playhead forward one frame.
   */
  movePlayheadForwards = () => {
    this.project.focus.timeline.playheadPosition++;
    this.project.guiElement.checkForPlayheadAutoscroll();
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the active timeline's playhead backwards one frame.
   */
  movePlayheadBackwards = () => {
    this.project.focus.timeline.playheadPosition--;
    this.project.guiElement.checkForPlayheadAutoscroll();
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Finishes a playhead moving operation.
   */
  finishMovingPlayhead = () => {
    this.projectDidChange({ actionName: "Finish Moving Playhead" });
  }

  /**
   * Determines the type of the object/objects that are in the selection state.
   * @returns {string} The string representation of the type of object/objects selected
   */
  getSelectionType = () => {
    return this.project.selection.selectionType;
  }

  /**
   * Returns true if the selection is scriptable.
   * @return {boolean} True if the selection is scriptable.
   */
  selectionIsScriptable = () => {
    return this.project.selection.isScriptable;
  }

  /**
   * The selected scriptable object.
   * @return {Wick.Frame|Wick.Clip} object - the scriptable object that is selected
   */
  getSelectedObjectScript = () => {
    if(this.selectionIsScriptable()) {
      return this.project.selection.getSelectedObject();
    } else {
      return null;
    }
  }

  /**
   * Returns all selected objects on the timeline.
   * @returns {(<Wick.Frame>|<Wick.Tween>)[]} An array containing the selected
   * tweens and frames
   */
  getSelectedTimelineObjects = () => {
    return this.project.selection.getSelectedObjects('Timeline');
  }

  /**
   * Returns all selected frames.
   * @returns {<Wick.Frame>)[]} An array containing the selected frames.
   */
  getSelectedFrames = () => {
    return this.project.selection.getSelectedObjects('Frame');
  }

  /**
   * Returns all selected tweens.
   * @returns {<Wick.Tween>)[]} An array containing the selected tweens.
   */
  getSelectedTweens = () => {
    return this.project.selection.getSelectedObjects('Tween');
  }

  /**
   * Returns all selected objects on the timeline.
   * @returns {(<Wick.Path>|<Wick.Clip>|<Wick.Button>)[]} An array containing
   * the selected clips and paths
   */
  getSelectedCanvasObjects = () => {
    return this.project.selection.getSelectedObjects('Canvas');
  }

  /**
   * Returns all selected paths.
   * @returns {<Wick.Path>)[]} An array containing the selected paths.
   */
  getSelectedPaths = () => {
    return this.project.selection.getSelectedObjects('Path');
  }

  /**
   * Returns all selected clips.
   * @returns {<Wick.Clip>)[]} An array containing the selected clips.
   */
  getSelectedClips = () => {
    return this.project.selection.getSelectedObjects('Clip');
  }

  /**
   * Returns all selected buttons.
   * @returns {<Wick.Button>)[]} An array containing the selected buttons.
   */
  getSelectedButtons = () => {
    return this.project.selection.getSelectedObjects('Button');
  }

  /**
   * Returns all selected objects in the asset library.
   * @returns {(<Wick.ImageAsset>|<Wick.SoundAsset>)[]} An array containing the
   * selected assets
   */
  getSelectedAssetLibraryObjects = () => {
    return this.project.selection.getSelectedObjects('AssetLibrary');
  }

  /**
   * Returns all selected sound assets from the asset library.
   * @returns {(<Wick.SoundAsset>)[]} An array containing the selected sound
   * assets.
   */
  getSelectedSoundAssets = () => {
    return this.project.selection.getSelectedObjects('SoundAsset');
  }

  /**
   * Returns all selected image assets from the asset library.
   * @returns {(<Wick.ImageAsset>)[]} An array containing the selected image
   * assets.
   */
  getSelectedImageAssets = () => {
    return this.project.selection.getSelectedObjects('ImageAsset');
  }

  /**
   * Returns the selected scriptable object if selection is a single scriptable
   * object.
   * @return {object|null} selected scriptable object.
   */
  getSelectedScriptableObject = () => {
    return this.project.selection.getSelectedObject().isScriptable
        && this.project.selection.getSelectedObject();
  }

  /**
   * Returns the number of objects selected on the canvas.
   * @return {number} Number of canvas objects selected.
   */
  getNumCanvasObjectsSelected = () => {
    return this.project.selection.numObjects;
  }

  /**
   * Clears the selection, then adds the given object to the selection.
   * @param {object} object - The object to add to the selection.
   */
  selectObject = (object) => {
    this.project.selection.select(object);
    this.projectDidChange({ actionName: "Select Object" });
  }

  /**
   * Clears the selection, then adds the given objects to the selection. No
   * changes will be made if the selection does not change.
   * @param {object[]} objects - The objects to add to the selection.
   */
  selectObjects = (objects) => {
    objects.forEach(object => {
      this.project.selection.select(object);
    });
    this.projectDidChange({ actionName: "Select Multiple Objects" });
  }

  /**
   * Clears the selection.
   */
  clearSelection = () => {
    this.project.selection.clear();
    this.projectDidChange({ actionName: "Clear Selection" });
  }

  /**
   * Selects everything on the canvas.
   */
  selectAll = () => {
    this.project.selectAll();
    this.projectDidChange({ actionName: "Select All" });
  }

  /**
   * Returns the value of a requested selection attribute.
   * @param  {string} attributeName Selection attribute to retrieve.
   * @return {string|number|undefined} Value of the selection attribute to
   * retrieve. Returns undefined is attribute does not exist.
   */
  getSelectionAttribute = (attributeName) => {
    let attribute = this.project.selection[attributeName];

    if(attribute instanceof Array) {
      if(attribute.length === 0) {
        return undefined;
      } else if (attribute.length === 1) {
        return attribute[0];
      } else {
        // TODO: Should return info about "mixed" attributes, but just
        // return the attribute of the first object for now.
        return attribute[0];
      }
    } else {
      return attribute;
    }
  }

  /**
   * Returns the names of all possible selection attribute names.
   * @return {string[]} Array of selection attribute names.
   */
  getAllSelectionAttributeNames = () => {
    return this.project.selection.allAttributeNames;
  }

  /**
   * Returns the new selection Attributes.
   * @return {object} object with new attributes.
   */
  getAllSelectionAttributes = () => {
    let newAttributes = {};

    let selectionAttributeNames = this.getAllSelectionAttributeNames();

    selectionAttributeNames.forEach(name => {
      newAttributes[name] = this.getSelectionAttribute(name);
    });

    return newAttributes;
  }

  /**
   * Updates the value of a selection attribute for the selected item in the editor.
   * @param {string} attribute Name of the attribute to update.
   * @param {string|number} newValue  New value of the attribute to update.
   */
  setSelectionAttribute = (attribute, newValue) => {
    this.project.selection[attribute] = newValue;
    this.projectDidChange({ actionName: "Set Selection Attribute: " + attribute + ":" + newValue});
  }

  /**
   * Determines if a given object is selected.
   * @param {object} object - Selection object to check if it is selected
   * @returns {boolean} - True if the object is selected, false otherwise
   */
  isObjectSelected = (object) => {
    return this.project.selection.isObjectSelected(object);
  }

  /**
   * Creates a new clip from the selected paths and clips and adds it to the project.
   * @param {string} name The name of the clip after creation.
   * @param {boolean} wrapSingularClip If the selection is just one Clip, should it be wrapped within another Clip?
   *    Default is true, to preserve existing script behavior.
   *    Calling this function with false ensures user doesn't accidentally wrap a Clip within another Clip.
   */
  createClipFromSelection = (name, wrapSingularClip = true) => {
    if (this.project.selection.numObjects === 0) {
      console.log("No selection from which to create clips.");
      return;
    } else if (!wrapSingularClip && this.project.selection.numObjects === 1
    && this.project.selection.types[0] === "Clip") {
      console.log("That's already a Clip.");
      return;
    }
    this.project.createClipFromSelection({
      identifier: name,
      type: 'Clip'
    });
    this.projectDidChange({ actionName: "Create Clip From Selection" });
  }

  /**
   * Creates a new button from the selected paths and clips and adds it to the project.
   * @param {string} name The name of the button after creation.
   */
  createButtonFromSelection = (name) => {
    this.project.createClipFromSelection({
      identifier: name,
      type: 'Button'
    });
    this.projectDidChange({ actionName: "Create Button From Selection" });
  }

  /**
   * Updates the focus object of the project.
   * @param {Wick.Clip} object Object to set as focus.
   */
  setFocusObject = (object) => {
    this.project.focus = object;
    this.projectDidChange({ actionName: "Set Focus Object" });
  }

  /**
   * Break apart the selected clip(s) and select the objects that were contained within those clip(s).
   */
  breakApartSelection = () => {
    //only break apart selections that have at least 1 clip or button
    //it might be better for these checks to go wherever project.breakApartSelection is defined
    var sel = this.project.selection;
    if (sel.numObjects === 0 || (!sel.types.includes("Clip") && !sel.types.includes("Button"))) {
      return;
    }
    this.project.breakApartSelection();
    this.projectDidChange({ actionName: "Break Apart Selection"});
  }

  /**
   * Deletes all selected objects.
   * @returns {object[]} The objects that were deleted.
   */
  deleteSelectedObjects = () => {
    if(this.project.selection.location === 'AssetLibrary') {
      this.openWarningModal({
        description: "Any objects in the project that are using this asset will also be deleted.",
        title: "Delete this asset?",
        acceptAction: (() => {
          this.project.deleteSelectedObjects();
          this.projectDidChange({ actionName: "Delete Selected Asset" });
        }),
        cancelAction: (() => {}),
        finalAction: (() => {}),
        acceptText: "Delete",
        cancelText: "Cancel",
      });
    } else {
      this.project.deleteSelectedObjects();
      this.projectDidChange({actionName: "Delete Selected Objects"});
    }
  }

  /**
   * Deletes a sub script from a script object.
   * @param {Object} scriptOwner Script owner to remove sub script from
   * @param {string} scriptName Name of the script to remove
   */
  deleteScript = (scriptOwner, scriptName) => {
    let oldEditorState = this.state.codeEditorOpen;

    // Turn off code editor if necessary, then open warning modal.
    this.toggleCodeEditor(false);

    this.openWarningModal({
      description: 'Delete Script: "' + scriptName + '" from the selected object?',
      title: "Delete Script",
      acceptText: "Delete",
      cancelText: "Cancel",
      acceptAction: (() => scriptOwner.removeScript(scriptName)),
      finalAction: (() => this.toggleCodeEditor(oldEditorState)), // Reopen code editor if necessary.
    });

  }

  /**
   * Opens the code editor to the script name tab if that tab exists.
   * @param {string} scriptName Name of the script to open the tab of. Must be all lowercase.
   */
  editScript = (scriptName) => {
    this.setState({
      scriptToEdit: scriptName,
      codeEditorOpen: true,
    });
  }

  /**
   * Moves the selected objects on the canvas to the back.
   */
  sendSelectionToBack = () => {
    this.project.selection.sendToBack();
    this.projectDidChange({ actionName: "Send Selection to Back" });
  }

  /**
   * Moves the selected objects on the canvas to the front.
   */
  sendSelectionToFront = () => {
    this.project.selection.bringToFront();
    this.projectDidChange({ actionName: "Bring Selection to Front" });
  }

  /**
   * Moves the selected objects on the canvas backwards.
   */
  moveSelectionBackwards = () => {
    this.project.selection.moveBackwards();
    this.projectDidChange({ actionName: "Move Selection Backwards" });
  }

  /**
   * Moves the selected objects on the canvas forwards.
   */
  moveSelectionForwards = () => {
    this.project.selection.moveForwards();
    this.projectDidChange({ actionName: "Move Selection Forwards" });
  }

  /**
   * Horizontally flips the canvas selection.
   */
  flipSelectedHorizontal = () => {
    this.project.selection.flipHorizontally();
    this.projectDidChange({ actionName: "Flip Selection Horizontal" });
  }

  /**
   * Vertically flips the canvas selection.
   */
  flipSelectedVertical = () => {
    this.project.selection.flipVertically();
    this.projectDidChange({ actionName: "Flip Selection Vertical" });
  }

  /**
   * Moves the selected objects up 1 pixel.
   */
  nudgeSelectionUp = () => {
    this.project.selection.y -= 1;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects down 1 pixel.
   */
  nudgeSelectionDown = () => {
    this.project.selection.y += 1;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects right 1 pixel.
   */
  nudgeSelectionRight = () => {
    this.project.selection.x += 1;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects left 1 pixel.
   */
  nudgeSelectionLeft = () => {
    this.project.selection.x -= 1;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects up 10 pixels.
   */
  nudgeSelectionUpMore = () => {
    this.project.selection.y -= 10;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects down 10 pixels.
   */
  nudgeSelectionDownMore = () => {
    this.project.selection.y += 10;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects right 10 pixels.
   */
  nudgeSelectionRightMore = () => {
    this.project.selection.x += 10;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Moves the selected objects left 10 pixels.
   */
  nudgeSelectionLeftMore = () => {
    this.project.selection.x -= 10;
    this.project.view.render();
    this.project.guiElement.draw();
  }

  /**
   * Finish the current nudging operation
   */
  finishNudgingObject = () => {
    this.projectDidChange({ actionName: "Nudge Elements" });
  }

  /**
   * Perform a boolean unite on the selected paths.
   */
  booleanUnite = () => {
    this.project.doBooleanOperationOnSelection('unite');
    this.projectDidChange({ actionName: "Boolean Unite" });
  }

  /**
   * Perform a boolean subtraction on the selected paths.
   */
  booleanSubtract = () => {
    this.project.doBooleanOperationOnSelection('subtract');
    this.projectDidChange({ actionName: "Boolean Subtract" });
  }

  /**
   * Perform a boolean intersection on the selected paths.
   */
  booleanIntersect = () => {
    this.project.doBooleanOperationOnSelection('intersect');
    this.projectDidChange({ actionName: "Boolean Intersect" });
  }

  /**
   * Updates the Wick Project settings with new values passed in as an object. Will make no changes if input is invalid or the same as the previous settings.
   * @param {object} newSettings an object containing all of the settings to update within the project. Accepts valid project settings such as 'name', 'width', 'height', 'framerate', and 'backgroundColor'.
   */
  updateProjectSettings = (newSettings) => {
    let validKeys = ["name", "width", "height", "backgroundColor", "framerate"];
    let updated = false;

    Object.keys(newSettings).forEach(key => {
      if (validKeys.indexOf(key) === -1) return;

      let oldVal = this.project[key];
      if (oldVal !== newSettings[key]) {
        this.project[key] = newSettings[key];
        updated = true;
      }
    });

    if (updated) {
      this.projectDidChange({ actionName: "Update Project Settings" });
    }
  }

  /**
   * Sets the project focus to the timeline of the currently selected clip.
   */
  focusTimelineOfSelectedObject = () => {
    this.project.focusTimelineOfSelectedClip();
    this.projectDidChange({ actionName: "Focus Selected Object Timeline" });
  }

  /**
   * Sets the project focus to the parent timeline of the currently selected clip.
   */
  focusTimelineOfParentClip = () => {
    this.project.focusTimelineOfParentClip();
    this.projectDidChange({ actionName: "Focus Timeline of Parent Clip" });
  }

  /**
   * Creates an image from an asset's uuid and places it on the canvas.
   * @param {string} uuid - The UUID of the desired asset.
   * @param {number} x - The x location of the image after creation in relation to the window.
   * @param {number} y - The y location of the image after creation in relation to the window.
   * @param {boolean} isCanvasSpace - If not set to true, x and y will be converted from screen space to canvas space
   */
  createImageFromAsset = (uuid, x, y, isCanvasSpace) => {
    // convert screen position to wick project position
    let paper = this.project.view.paper;
    let dropPoint = new paper.Point();
    if(isCanvasSpace) {
      dropPoint = new paper.Point(x,y);
    } else {
      let canvasPosition = paper.project.view.element.getBoundingClientRect();
      x -= canvasPosition.x;
      y -= canvasPosition.y;
      dropPoint = paper.view.viewToProject(new window.paper.Point(x,y));
    }

    let obj = window.Wick.ObjectCache.getObjectByUUID(uuid);

    if (obj instanceof window.Wick.ImageAsset) {
      this.project.createImagePathFromAsset(window.Wick.ObjectCache.getObjectByUUID(uuid), dropPoint.x, dropPoint.y, path => {
        this.projectDidChange({ actionName: "Create Image Path From Asset"});
      });
    } else if (obj instanceof window.Wick.ClipAsset) {
      this.project.createClipInstanceFromAsset(window.Wick.ObjectCache.getObjectByUUID(uuid), dropPoint.x, dropPoint.y, clip => {
        this.projectDidChange({ actionName: "Create Clip Instance From Asset"});
      });
    } else if (obj instanceof window.Wick.SVGAsset) {
      this.project.createSVGInstanceFromAsset(window.Wick.ObjectCache.getObjectByUUID(uuid), dropPoint.x, dropPoint.y, svg => {
        this.projectDidChange({ actionName: "Create SVG Instance From Asset"});
      });
    }else {
      console.error('object is not an ImageAsset or a ClipAsset')
    }
  }

 /**
  * Creates an instance of the selected asset at the center of the canvas
  */
  createInstanceOfSelectedAsset = () => {
    let uuid = this.project.selection.getSelectedObject().uuid;
    this.createImageFromAsset(uuid, this.project.width/2, this.project.height/2, true);
  }

 /**
   * Is called when a sound asset is dragged/dropped on the timeline element.
   * @param {string} uuid - The UUID of the desired asset.
   * @param {number} x - The x location of the image after creation in relation to the window.
   * @param {number} y - The y location of the image after creation in relation to the window.
   * @param {boolean} drop - If true, will drop the asset with the uuid onto the hovered frame, modifying the frame.
   */
  dragSoundOntoTimeline = (uuid, x, y, drop) => {
      this.project.guiElement.dragAssetAtPosition(uuid, x, y, drop);
  }

  /**
   * Attempts to import an arbitrary asset to the project. Displays an error or success message
   * depending on if the action was successful.
   * @param {File} file - File object to create an asset of.
   * @param {Function} callback - (optional) Callback to return asset to. If the import was unsuccessful, null is sent to the callback.
   */
  importFileAsAsset = (file, callback) => {
    this.project.importFile(file, (asset) => {
      if (callback) callback(asset);

      if(asset === null) {
        this.toast('Could not add files to project: ' + file.name, 'error');
      } else {
        this.toast('Imported "' + file.name + '" successfully.', 'success');
        this.projectDidChange({ actionName: "Import File As Asset" });
      }
    });
  }

  /**
   * Creates and imports Wick Assets from the acceptedFiles list, and displays an alert message for rejected files.
   * @param {File[]} acceptedFiles - Files uploaded by user with supported MIME types to import into the project
   * @param {File[]} rejectedFiles - Files uploaded by user with unsupported MIME types.
   */
  createAssets = (acceptedFiles, rejectedFiles) => {
    let toastID = this.toast('Importing files...', 'info');

    // Error message for failed uploads
    if (rejectedFiles.length > 0) {
      let fileNamesRejected = rejectedFiles.map(file => file.name).join(', ');
      this.updateToast(toastID, {
        type: 'error',
        text: 'Could not import files: ' + fileNamesRejected});
    }

    // Add all successfully uploaded assets
    for(var i = 0; i < acceptedFiles.length; i++) {
      if(acceptedFiles[i].type === 'image/gif') {
        GIFImport.importGIFIntoProject({
            gifFile: acceptedFiles[i],
            project: this.project,
            onProgress: (percent) => {
                console.log('GIFImport onProgress: ' + percent);
            },
            onFinish: (gifAsset) => {
                console.log('GIFImport onFinish:')
                console.log(gifAsset)
                this.project.addAsset(gifAsset);
                this.projectDidChange({ actionName: "Add Asset" });
            }});
      } else {
        var file = acceptedFiles[i];
        this.importFileAsAsset(file);
      }
    }
  }

  /**
   * Begin interactive object creation process.
   */
  beginMakeInteractiveProcess = () => {
    this.openModal("MakeInteractive");
  }

  /**
   * Begin animated object creation process.
   */
  beginMakeAnimatedProcess = () => {
    this.openModal("MakeAnimated");
  }

  /**
   * Export the current project to a new window.
   */
  exportProjectToNewWindow = () => {
    this.showWaitOverlay();
    window.Wick.HTMLPreview.previewProject(this.project, previewWindow => {
      this.hideWaitOverlay();
      if (previewWindow) {
        this.toast('Project preview window opened.', 'info', {autoClose: false});
      } else {
        // If pop ups are disabled, previewWindow will be null.
        this.toast('Could not open a preview window. Try disabling your popup blocker!', 'error', {autoClose: false});
      }
    });
  }

  /**
   * Export the current project as a Wick File using the save as dialog.
   */
  exportProjectAsWickFile = () => {
    this.showWaitOverlay();

    let toastID = this.toast('Exporting project as a .wick file...', 'info', {autoClose: false});
    window.Wick.WickFile.toWickFile(this.project, file => {
      if (file === undefined) {
        this.updateToast(toastID, {
          type: 'error',
          text: "Could not export .wick file." });
        this.hideWaitOverlay();
        return;
      }

      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully saved .wick file." });
      saveAs(file, this.project.name + timeStamp() + '.wick');
      this.hideWaitOverlay();
    });
  }

  /**
   * Export the current project as an animated GIF.
   */
  exportProjectAsAnimatedGIF = (args) => {
    // Open export media loading bar modal.
    this.openModal('ExportMedia');
    this.setState({
      renderProgress: 0,
      renderType: "gif",
      renderStatusMessage: "Creating gif.",
    });

    // this.showWaitOverlay();
    let outputName = args.name || this.project.name;
    let toastID = this.toast('Exporting animated GIF...', 'info');

    let onProgress = (message, progress) => {
      this.setState({
        renderStatusMessage: message,
        renderProgress: progress
      });
    }

    let onError = (message) => {
      console.error("Gif Render had an error with message: ", message);
    }

    let onFinish = (gifBlob) => {
      saveAs(gifBlob, outputName + '.gif');
      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully created .gif file." });
      this.setState({
        renderStatusMessage: 'Finished exporting GIF.',
        renderProgress: 100
      });
    }

    GIFExport.createAnimatedGIFFromProject({
      width: args.width,
      height: args.height,
      project: this.project,
      onFinish: onFinish,
      onError: onError,
      onProgress: onProgress,
    });

  }

  /**
   * Export the current project as an image sequence
   */
  exportProjectAsImageSequence = (args) => {
    this.openModal('ExportMedia');
    this.setState({
      renderProgress: 0,
      renderType: "image sequence",
      renderStatusMessage: "Creating image sequence.",
      exporting: true,
    });

    let toastID = this.toast('Exporting image sequence...', 'info');

    let onProgress = (completed, maxFrames) => {
      let message = "Rendered " + completed + "/" + maxFrames + " frames";
      let percentage = 10 + (90 * (completed/maxFrames));
      this.setState({
        renderStatusMessage: message,
        renderProgress: percentage,
      });
    }

    let onError = (message) => {
      console.error("Image Render had an error with message: ", message);
    }

    let onFinish = (sequenceBlobZip) => {
      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully created image sequence." });
      saveAs(sequenceBlobZip, this.project.name +'_imageSequence.zip');
      this.setState({
        exporting: false,
      })
    }

    window.Wick.ImageSequence.toPNGSequence({
      project: this.project,
      width: args.width,
      height: args.height,
      onProgress: onProgress,
      onError: () => {
        this.hideWaitOverlay();
        onError();
      },
      onFinish: (file) => {
        this.hideWaitOverlay();
        onFinish(file);
      },
    });
  }

  /**
   * Export the current project as a video.
   */
  exportProjectAsVideo = (args) => {
    // Open export media loading bar modal.
    this.openModal('ExportMedia');
    this.setState({
      renderProgress: 10,
      renderType: "video",
      renderStatusMessage: "Creating video.",
      exporting: true,
    });

    let toastID = this.toast('Exporting video...', 'info');

    let onProgress = (message, progress) => {
      this.setState({
        renderStatusMessage: message,
        renderProgress: progress
      });
    }

    let onError = (message) => {
      console.error("Video Render had an error with message: ", message);
    }

    let onFinish = (message) => {
      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully created .mp4 file." });
      console.log("Video Render Complete: ", message);

      this.setState({
        exporting: false,
      });
    }

    // this.showWaitOverlay('Rendering video...');
    VideoExport.renderVideo({
      project: this.project,
      width: args.width,
      height: args.height,
      onProgress: onProgress,
      onError: () => {
        this.hideWaitOverlay();
        onError();
      },
      onFinish: () => {
        this.hideWaitOverlay();
        onFinish();
      },
    });
  }
    /**
   * Export the current project as a video.
   */

  exportProjectAsImageSVG = () => {
    // Open export media loading bar modal.
    this.openModal('ExportMedia');
    this.setState({
      renderProgress: 0,
      renderType: "svg",
      renderStatusMessage: "Creating svg.",
    });

    let toastID = this.toast('Exporting svg...', 'info');

    let onError = (message) => {
      console.error("SVG builder had an error with message: ", message);
    }

    let onFinish = (file) => {
      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully saved .wick file." });
        saveAs(file, this.project.name + timeStamp() + '.svg');
        this.hideWaitOverlay();
    }

    // this.showWaitOverlay('Rendering video...');
    window.Wick.SVGFile.toSVGFile(this.project.activeTimeline,
       onError,file => {
        this.hideWaitOverlay();
        onFinish(file);
      });
  }

  /**
   * Export the current project as a bundled standalone ZIP that can be uploaded to itch/newgrounds/etc.
   */
  exportProjectAsStandaloneZip = (args) => {
    let toastID = this.toast('Exporting project as ZIP...', 'info');
    let outputName = args.name || this.project.name;
    window.Wick.ZIPExport.bundleProject(this.project, blob => {
      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully created .zip file." });
      saveAs(blob, outputName + '.zip');
    });
  }

  /**
   * Export the current project as a bundled standalone HTML file.
   */
  exportProjectAsStandaloneHTML = (args) => {
    let toastID = this.toast('Exporting project as HTML...', 'info');
    let outputName = args.name || this.project.name;
    window.Wick.HTMLExport.bundleProject(this.project, html => {
      this.updateToast(toastID, {
        type: 'success',
        text: "Successfully created .html file." });
      saveAs(new Blob([html], {type: "text/plain"}), outputName + '.html');
    });
  }

  /**
   * Exports the audio of a Wick project's audio as a single track in an audio file.
   */
  exportProjectAsAudioTrack = (args) => {
    AudioExport.generateAudioFile({
      project: this.project,
    }).then((result) => {
      saveAs(new Blob([result]), 'audiotrack.wav');
    });
  }

  /**
   * Imports a wick file into the editor.
   * @param {File} file Zipped wick file to import.
   */
  importProjectAsWickFile = (file) => {
    this.showWaitOverlay();
    window.Wick.WickFile.fromWickFile(file, project => {
      if(project) {
        this.setupNewProject(project);
        this.toast('Opened "' + file.name + '" successfully.', 'success');
      } else {
        this.toast('Could not open project.', 'error');
        this.hideWaitOverlay();
      }
    });
  }

  /**
   * Sets up a new project in the editor. This operation will remove the
   * history, selection, and all other ability to retrieve your project.
   * @param {Wick.Project} project - the project to load.
   */
  setupNewProject = (project) => {
    this.resetEditorForLoad();
    this.project = project || new window.Wick.Project();
    this.project.selection.clear();

    // Attach error handling messages
    this.attachErrorHandlers();

    this.projectDidChange({ actionName: "Setup New Project" });
    this.hideWaitOverlay();
    this.project.view.prerender();
    this.project.view.render();
  }

  openNewProjectConfirmation = () => {
    this.openWarningModal({
      description: "You will lose any unsaved changes to the current project.",
      title: "Open a New Project?",
      acceptAction: (() => {
        setTimeout(() => {
          this.setupNewProject();
        }, 100)
      }),
      cancelAction: (() => {}),
      finalAction: (() => {

      }),
      acceptText: "Accept",
      cancelText: "Cancel",
    });
  }

  showAutosavedProjects = () => {
    this.doesAutoSavedProjectExist(exists => {
      if (exists) {
        this.queueModal('AutosaveWarning');
      }
    });
  }

  /**
   * Parses a URL passed into the editor using ?project=file.wick in the URL. URLs must be encoded with encodeURIComponent.
   */
  tryToParseProjectURL = () => {
    // Retrieve URL
    var urlParams = queryString.parse(window.location.search);
    var urlParam = urlParams.project;

    // No URL param, skip the download
    if(!urlParam) {
      return false;
    }

    // Parse requested URL
    var url = new urlParse(urlParam);

    // Check if the provided URL is allowed in the whitelist.
    var whitelist = ['wickeditor.com', 'editor.wickeditor.com', 'test.wickeditor.com', 'aka.ms'];
    if(whitelist.indexOf(url.hostname) === -1) {
      this.toast('Could not open project from link! \n URL is not on whitelist.','warning');
      console.error('tryToParseProjectURL: URL is not in the whitelist.');
      return false;
    }

    // Download and open the wick project.
    fetch(url)
      .then(resp => resp.blob())
      .then(blob => {
        window.Wick.WickFile.fromWickFile(blob, loadedProject => {
          this.setupNewProject(loadedProject);
        }, 'blob');
      })
      .catch((e) => {
        this.toast('Could not download project from URL.','warning');
        console.error('tryToParseProjectURL: Could not download Wick project.')
        console.error(e);
      });

    return true;
  }

  /**
   * Attach toast messages to the engine error handler.
   */
  attachErrorHandlers = () => {
    this.project.onError(message => {
      console.log(message)
      if(message === 'OUT_OF_BOUNDS' || message === 'LEAKY_HOLE') {
        this.toast('The shape you are trying to fill has a gap.', 'warning');
      } else if (message === 'NO_PATHS') {
        this.toast('There is no hole to fill.', 'warning');
      } else if (message === 'CLICK_NOT_ALLOWED_LAYER_LOCKED') {
        this.toast('The layer you are trying to draw onto is locked.', 'warning');
      } else if (message === 'CLICK_NOT_ALLOWED_LAYER_HIDDEN') {
        this.toast('The layer you are trying to draw onto is hidden.', 'warning');
      } else if (message === 'CLICK_NOT_ALLOWED_NO_FRAME') {
        this.toast('There is no frame to draw onto.', 'warning');
      } else {
        this.toast(message, 'warning');
      }
    });
  }

  /**
   * Start a timer to run an autosave sometime in the future.
   */
  requestAutosave = () => {
      window.clearTimeout(this._autosaveTimeoutID);
      this._autosaveTimeoutID = window.setTimeout(() => {
          this.autoSaveProject(() => {

          });
      }, 1000 * 60);
  }

  /**
   * Save the current project in localstorage
   */
  autoSaveProject = (callback) => {
    if (!this.project) return;
    if (this.state.previewPlaying) return;
    if (this.state.activeModalName !== null) return;

    window.Wick.AutoSave.save(this.project, () => {
      callback();
    });
  }

  /**
   * Attempts to automatically load an autosaved project if it exists.
   * Does nothing if not autosaved project is stored.
   */
  loadAutosavedProject = (callback) => {
    window.Wick.AutoSave.getAutosavesList(autosaveList => {
      if(!autosaveList[0]) {
        callback();
      } else {
        this.showWaitOverlay();
        window.Wick.AutoSave.load(autosaveList[0].uuid, project => {
          this.setupNewProject(project);
          this.hideWaitOverlay();
          callback();
        });
      }
    });
  }

  /**
   * Check if auto saved project exists.
   * @param  {Function} callback a callback which receives a boolean.
   * True if an autosave exists.
   */
  doesAutoSavedProjectExist = (callback) => {
    window.Wick.AutoSave.getAutosavesList(autosaveList => {
      callback(autosaveList.length > 0);
    });
  }

  /**
   * Clears any autosaved project from local storage.
   */
  clearAutoSavedProject = (callback) => {
    window.Wick.AutoSave.delete(this.project.uuid, () => {
      callback();
    });
  }

  /**
   * Toggle onion skinning on/off.
   */
  toggleOnionSkin = () => {
    this.project.onionSkinEnabled = !this.project.onionSkinEnabled;
    this.projectDidChange({ actionName: "Toggle Onion Skinning" });
  }

  /**
   * Return all possible sound assets.
   */
  getAllSoundAssets = () => {
    return this.project.getAssets('Sound');
  }

  /**
   * Toggles the preview play between on and off states.
   */
  togglePreviewPlaying = () => {
    if(this.processingAction) return;

    let onionSkinningWasOn = false;
    if (!this.state.previewPlaying && this.project.onionSkinEnabled) {
      this.toggleOnionSkin();
      onionSkinningWasOn = true;
    }

    this.showWaitOverlay();
    this.processingAction = true;

    // Apply the change of the current selection before clearing it.
    if(this.project.selection.numObjects > 0) {
      this.project.view.applyChanges();
      this.project.selection.clear();
    }

    // Turn onion skinning back on if it was turned off.
    if (this.state.previewPlaying && this.state.onionSkinningWasOn && !this.project.onionSkinEnabled) {
      this.toggleOnionSkin();
    }

    this.setState({
      previewPlaying: !this.state.previewPlaying,
      showCodeErrors: false,
      onionSkinningWasOn: onionSkinningWasOn,
    });

    this.hideWaitOverlay();
    this.processingAction = false;
  }

  /**
   * Start playing the project from the beginning of the timeline.
   */
  startPreviewPlayFromBeginning = () => {
      if(this.state.previewPlaying) return;

      this.project.focus.timeline.playheadPosition = 1;
      this.togglePreviewPlaying();
  }

  /**
   * Stops the project if it is currently preview playing and displays any errors in the code window.
   */
  stopPreviewPlaying = () => {
    this.setState({
      previewPlaying: false,
      codeEditorOpen: this.project.error === undefined ? this.state.codeEditorOpen : true,
      showCodeErrors: this.project.error === undefined ? false : true,
    });

    if(this.project.error) {
        this.editScript(this.project.error.name);
    }

    this.projectDidChange({ actionName: "Stop Preview Playing" });
  }

  /**
   * Clears the current error message in the project.
   */
  clearCodeEditorError = () => {
      this.project.error = null;
      this.projectDidChange({ actionName: "Clear Code Editor Error" });
  }

  /**
   * Copies the selection state and selected objects to the clipboard.
   */
  copySelectionToClipboard = () => {
    if(this.project.copySelectionToClipboard()) {
      this.projectDidChange({ actionName: "Copy Selection" });
    } else {
      this.toast('There is nothing to copy.', 'warning');
    }
  }

  /**
   * Duplicates the current objects in the selection.
   */
  duplicateSelection = () => {
    if(this.project.duplicateSelection()) {
      this.projectDidChange({actionName: "Duplicate Selection" });
    } else {
      this.toast('There is nothing to duplicate.', 'warning');
    }
  }

  /**
   * Copies the selected objects to the clipboard and then deletes them from the project.
   */
  cutSelectionToClipboard = () => {
    if(this.project.cutSelectionToClipboard()) {
      this.projectDidChange({ actionName: "Cut Selection"});
    } else {
      this.toast('There is nothing to duplicate.', 'warning');
    }
  }

  /**
   * Attempts to paste in objects on the clipboard if they are available.
   * @return {[type]} [description]
   */
  pasteFromClipboard = () => {
    if(this.project.pasteClipboardContents()) {
      this.projectDidChange({ actionName: "Paste from Clipboard" });
    } else {
      this.toast('There is nothing in the clipboard to paste.', 'warning');
    }
  }

  /**
   * Creates a new keyframe at the current playhead position.
   */
  addTweenKeyframe = () => {
    if(!this.project.activeFrame) return;
    this.project.activeFrame.createTween();
    this.projectDidChange({ actionName: "Add Tween Keyframe" });
  }

  /**
   * Returns all existing fonts in the project.
   */
  getExistingFonts = () => {
    return this.project.getFonts();
  }

  /**
   * returns true if the project has the passed in font.
   * @param {string} font Font to check
   * @return {boolean} true if the project has this font.
   */
  hasFont = (font) => {
    return this.project.hasFont(font);
  }

  extendFrame = () => {
      var frames = this.project.selection.getSelectedObjects('Frame');
      this.project.extendFrames(frames);
      this.project.guiElement.draw();
  }

  shrinkFrame = () => {
      var frames = this.project.selection.getSelectedObjects('Frame');
      this.project.shrinkFrames(frames);
      this.project.guiElement.draw();
  }

  moveFrameRight = () => {
      this.project.moveSelectedFramesRight();
      this.project.guiElement.draw();
  }

  moveFrameLeft = () => {
      this.project.moveSelectedFramesLeft();
      this.project.guiElement.draw();
  }

  createTween = () => {
      this.project.createTween();
      this.projectDidChange({ actionName: "Create Tween" });
  }

  cutFrame = () => {
      this.project.cutSelectedFrames();
      this.projectDidChange({ actionName: "Cut Frame" });
  }

  insertBlankFrame = () => {
      this.project.insertBlankFrame();
      this.projectDidChange({ actionName: "Insert Blank Frame" });
  }

  extendSelectedFramesAndPushOtherFrames = () => {
      var frames = this.project.selection.getSelectedObjects('Frame');
      this.project.extendFramesAndPushOtherFrames(frames);
      this.project.guiElement.draw();
  }

  shrinkSelectedFramesAndPullOtherFrames = () => {
      var frames = this.project.selection.getSelectedObjects('Frame');
      this.project.shrinkFramesAndPullOtherFrames(frames);
      this.project.guiElement.draw();
  }

  extendActiveFramesAndPushOtherFrames = () => {
      var frames = this.project.activeTimeline.activeFrames;
      this.project.extendFramesAndPushOtherFrames(frames);
      this.project.guiElement.draw();
  }

  shrinkActiveFramesAndPullOtherFrames = () => {
      var frames = this.project.activeTimeline.activeFrames;
      this.project.shrinkFramesAndPullOtherFrames(frames);
      this.project.guiElement.draw();
  }

  exportSelectedClip = () => {
      var clip = this.project.selection.getSelectedObject();
      if(!clip) return;
      if(!(clip instanceof window.Wick.Clip)) return;

      window.Wick.WickObjectFile.toWickObjectFile(clip, 'blob', file => {
          window.saveAs(file, (clip.identifier || 'object') + '.wickobj');
      });
  }

  onEyedropperPickedColor = (e) => {
      this._onEyedropperPickedColor(e.color);
      this.activateLastTool();
  }
}

export default EditorCore;
