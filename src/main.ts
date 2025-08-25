/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

// Tipos para o sistema de reserva de mesas
type DeskOccupant = { name: string; since: number };

declare module "@workadventure/iframe-api-typings" {
  interface RoomState {
    desks: Record<string, DeskOccupant | null>;
  }
}

console.log('Script started successfully');

let currentPopup: any = undefined;
let deskMessages: Record<string, any> = {};

// Funções utilitárias para gerenciar o estado das mesas
const getDesks = () => (WA.state.desks ?? {}) as Record<string, DeskOccupant | null>;
const saveDesks = (next: Record<string, DeskOccupant | null>) =>
  WA.state.saveVariable("desks", next);

// Função para atualizar o feedback visual das mesas
const updateDeskVisual = (areaName: string, occupant: DeskOccupant | null) => {
  if (occupant) {
    // Mostra layer de mesa ocupada (se existir)
    try {
      WA.room.showLayer(`${areaName}-occupied`);
      WA.room.hideLayer(`${areaName}-available`);
    } catch (e) {
      console.log(`Layers ${areaName}-occupied ou ${areaName}-available não encontradas`);
    }
  } else {
    // Mostra layer de mesa disponível (se existir)
    try {
      WA.room.hideLayer(`${areaName}-occupied`);
      WA.room.showLayer(`${areaName}-available`);
    } catch (e) {
      console.log(`Layers ${areaName}-occupied ou ${areaName}-available não encontradas`);
    }
  }
};

// Função para mostrar mensagem de ação da mesa
const showDeskActionMessage = (areaName: string) => {
  const desks = getDesks();
  const me = WA.player.name;
  const isMine = desks[areaName]?.name === me;

  let message = "";
  if (!desks[areaName]) {
    message = "Clique para reservar esta mesa";
  } else if (isMine) {
    message = "Clique para liberar sua mesa";
  } else {
    message = `Mesa ocupada por ${desks[areaName]!.name}`;
  }

  deskMessages[areaName] = WA.ui.displayActionMessage({
    message: message,
    callback: async () => {
      const current = getDesks();
      const now = Date.now();

      if (!current[areaName]) {
        // Reservar mesa
        current[areaName] = { name: me, since: now };
        await saveDesks(current);
        WA.chat.sendChatMessage("Mesa reservada! 👏", "sistema");
      } else if (current[areaName]!.name === me) {
        // Liberar mesa
        current[areaName] = null;
        await saveDesks(current);
        WA.chat.sendChatMessage("Mesa liberada! ✅", "sistema");
      }
    },
  });
};

// Waiting for the API to be ready
WA.onInit().then(() => {
    console.log('Scripting API ready');
    console.log('Player tags: ',WA.player.tags)

    // Sistema de relógio existente
    WA.room.area.onEnter('clock').subscribe(() => {
        const today = new Date();
        const time = today.getHours() + ":" + today.getMinutes();
        currentPopup = WA.ui.openPopup("clockPopup", "It's " + time, []);
    })

    WA.room.area.onLeave('clock').subscribe(closePopup)

    // Sistema de reserva de mesas
    const deskAreas = [
      "desk-01", "desk-02", "desk-03", "desk-04", "desk-05",
      "desk-06", "desk-07", "desk-08", "desk-09", "desk-10",
      "desk-11", "desk-12", "desk-13", "desk-14", "desk-15",
      "desk-16", "desk-17", "desk-18", "desk-19", "desk-20",
      "desk-21", "desk-22", "desk-23", "desk-24", "desk-25",
      "desk-26", "desk-27", "desk-28", "desk-29", "desk-30",
      "desk-31", "desk-32", "desk-33", "desk-34", "desk-35",
      "desk-36", "desk-37", "desk-38", "desk-39", "desk-40",
      "desk-41", "desk-42", "desk-43", "desk-44", "desk-45",
      "desk-46", "desk-47", "desk-48", "desk-49", "desk-50"
    ]; // 50 áreas de mesa disponíveis

    deskAreas.forEach((areaName) => {
      // Ao entrar na área da mesa
      WA.room.area.onEnter(areaName).subscribe(() => {
        showDeskActionMessage(areaName);
      });
      console.log('Desk area: ',areaName)
      // Ao sair da área da mesa
      WA.room.area.onLeave(areaName).subscribe(() => {
        if (deskMessages[areaName]) {
          deskMessages[areaName].remove();
          deskMessages[areaName] = null;
        }
      });
    });

    // Listener para mudanças no estado das mesas (atualização em tempo real)
    WA.state.onVariableChange("desks").subscribe(() => {
      const desks = getDesks();
      
      // Atualiza o feedback visual para todas as mesas
      deskAreas.forEach((areaName) => {
        updateDeskVisual(areaName, desks[areaName]);
        
        // Atualiza a mensagem de ação se o usuário estiver na área
        if (deskMessages[areaName]) {
          deskMessages[areaName].remove();
          showDeskActionMessage(areaName);
        }
      });
    });

    // Inicializa o estado visual das mesas
    const initialDesks = getDesks();
    deskAreas.forEach((areaName) => {
      updateDeskVisual(areaName, initialDesks[areaName]);
    });

    // The line below bootstraps the Scripting API Extra library that adds a number of advanced properties/features to WorkAdventure
    bootstrapExtra().then(() => {
        console.log('Scripting API Extra ready');
    }).catch(e => console.error(e));

}).catch(e => console.error(e));

function closePopup(){
    if (currentPopup !== undefined) {
        currentPopup.close();
        currentPopup = undefined;
    }
}

export {};
