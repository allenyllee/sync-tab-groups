import React from 'react'
import ReactDOM from 'react-dom'

import Utils from '../../background/utils/utils'

document.addEventListener("DOMContentLoaded", async() => {

  document.title = "Shortcuts List for Tab Groups Resurrection";
  // Set tab icon
  Utils.setIcon("../../share/icons/tab-groups-resurrection-64.png");

  let list_commands = await browser.commands.getAll();

  ReactDOM.render(
    (<div>
      <div className="title">
        <img
          src="../../share/icons/tab-groups-resurrection-64.png"
          alt="Tab Groups Resurrection icon"
          width="64"
          height="64"
        />
        Tab Groups Resurrection
      </div>
      <div className="help">
        <h1 className="shortcut-list">
          {browser.i18n.getMessage("shortcut_list")}
        </h1>
        <table className="list_help">
          <tbody>
            <tr>
              <th className="command_shortcuts">{browser.i18n.getMessage("command_shortcuts")}</th>
              <th className="command_description">{browser.i18n.getMessage("command_description")}</th>
            </tr>
            {
              list_commands.map((command) => {
                return (
                  <tr key={command.name}>
                    <td className="command_shortcuts">{command.shortcut}</td>
                    <td className="command_description">{browser.i18n.getMessage("command_description_" + command.name)}</td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
    </div>)
    , document.getElementById("content"));

});
