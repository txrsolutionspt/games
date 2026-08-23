// Portuguese translation — PLAN.md §6. UI-chrome strings mirror every key
// in locale-en.js; content-string keys (crop./animal./building./recipe./
// mission.) are overrides for the English text embedded as fallback in the
// data-*.js files, so only the keys actually translated need to be listed
// here.

const LOCALE_PT = {
  'ui.tool.plant': 'Plantar',
  'ui.tool.water': 'Regar',
  'ui.tool.harvest': 'Colher',
  'ui.tool.animals': 'Animais',
  'ui.tool.build': 'Construir',

  'ui.hud.day': 'Dia',
  'ui.season.spring': 'Primavera',
  'ui.season.summer': 'Verão',
  'ui.season.fall': 'Outono',
  'ui.season.winter': 'Inverno',
  'ui.weather.sunny': 'Ensolarado',
  'ui.weather.rainy': 'Chuvoso',
  'ui.weather.cloudy': 'Nublado',

  'ui.shop.crops.title': 'Escolha uma Semente',
  'ui.shop.animals.title': 'Escolha um Animal',
  'ui.shop.build.title': 'Escolha uma Construção',
  'ui.shop.close': 'Fechar',
  'ui.shop.outOfSeason': 'Cresce melhor noutra estação',

  'ui.plot.locked.title': 'Terreno Bloqueado',
  'ui.plot.locked.body': 'Desbloqueie este terreno para cultivar mais!',
  'ui.plot.locked.unlock': 'Desbloquear',
  'ui.plot.empty.hint': 'Toque em Plantar para cultivar algo aqui!',

  'ui.animal.feed': 'Alimentar',
  'ui.animal.water': 'Regar',
  'ui.animal.collect': 'Recolher',
  'ui.animal.needFeed': 'Precisa de trigo para se alimentar',
  'ui.animal.happy': 'Feliz!',
  'ui.animal.hungry': 'Precisa de comida ou água',
  'ui.animal.thirsty': 'Precisa de comida e água',

  'ui.building.needs': 'Precisa de:',
  'ui.building.start': 'Iniciar',
  'ui.building.ready': 'Pronto!',
  'ui.building.inProgress': 'A trabalhar...',

  'ui.mission.completed': 'Missão Concluída!',
  'ui.mission.ok': 'Entendi!',

  'ui.market.title': 'Mercado',
  'ui.market.sell': 'Vender 1',
  'ui.market.each': 'cada',

  'ui.inventory.empty': 'Ainda nada — vá colher alguma coisa!',

  'ui.settings.title': 'Definições',
  'ui.settings.language': 'Idioma',
  'ui.settings.privacy': 'Privacidade para os Pais',
  'ui.settings.reset': 'Repor Dados do Jogo',
  'ui.settings.resetConfirm': 'Isto vai apagar todo o progresso neste dispositivo. Tem a certeza?',
  'ui.settings.resetConfirmYes': 'Sim, Repor',
  'ui.settings.resetConfirmNo': 'Cancelar',

  'ui.privacy.body': 'Este jogo não recolhe qualquer informação pessoal. O progresso é guardado apenas no seu dispositivo. Não há contas, anúncios, rastreamento nem funcionalidades online. Pode repor todos os dados a qualquer momento nas Definições.',
  'ui.privacy.fullToggle': 'Aviso completo',
  'ui.privacy.fullBody': 'Não recolhemos qualquer informação pessoal: sem nomes, emails, fotos ou localização. Não existem contas, autenticação nem cópias na nuvem, nem publicidade, análise ou rastreamento de terceiros. Tudo é guardado apenas no armazenamento local deste navegador, neste dispositivo. Você (ou um encarregado de educação) pode apagar tudo a qualquer momento com "Repor Dados do Jogo" nas Definições, ou limpando os dados deste site nas definições do navegador.',

  'ui.toast.notEnoughCoins': 'Ainda não tem moedas suficientes!',
  'ui.toast.planted': 'Plantado!',
  'ui.toast.placed': 'Bem-vindo à quinta!',
  'ui.toast.built': 'Construído!',
  'ui.toast.notNeeded': 'Já foi regado o suficiente por agora!',
  'ui.toast.watered': 'Regado!',
  'ui.toast.notReady': 'Ainda não está pronto!',
  'ui.toast.harvested': 'Colhido!',
  'ui.toast.fed': 'Alimentado!',
  'ui.toast.collected': 'Recolhido!',
  'ui.toast.started': 'Iniciado!',
  'ui.toast.unlocked': 'Terreno desbloqueado!',

  'ui.info.growth': 'Crescimento',
  'ui.info.water': 'Água',

  'ui.tutorial.plant': 'Toque em Plantar, escolha Trigo e depois toque num terreno vazio!',
  'ui.tutorial.water': 'Agora toque em Regar e depois toque no seu trigo!',
  'ui.tutorial.harvest': 'Ótimo! Espere que cresça, depois toque em Colher e toque nele outra vez!',
  'ui.tutorial.done': 'Agora é um agricultor! Explore e faça crescer a sua quinta.',

  'crop.wheat.name': 'Trigo',
  'crop.wheat.fact': 'O trigo é uma gramínea. O seu grão é moído para fazer farinha para o pão.',
  'crop.carrot.name': 'Cenoura',
  'crop.carrot.fact': 'As cenouras são raízes — a parte que cresce debaixo da terra, absorvendo água e nutrientes do solo.',
  'crop.tomato.name': 'Tomate',
  'crop.tomato.fact': 'Os tomates precisam de muito sol e água antes de estarem prontos para se tornarem molho.',
  'crop.corn.name': 'Milho',
  'crop.corn.fact': 'O milho é uma gramínea alta que cresce depressa no calor do verão.',
  'crop.strawberry.name': 'Morango',
  'crop.strawberry.fact': 'Os morangos crescem rente ao chão e amadurecem depressa quando o tempo aquece.',
  'crop.potato.name': 'Batata',
  'crop.potato.fact': 'As batatas crescem debaixo da terra e guardam energia extra para a planta — por isso são tão nutritivas.',

  'animal.chicken.name': 'Galinha',
  'animal.chicken.fact': 'As galinhas transformam o trigo que você cultiva em ovos — as quintas de verdade alimentam os animais com o que cultivam.',
  'animal.cow.name': 'Vaca',
  'animal.cow.fact': 'As vacas comem grão e erva e transformam-nos em leite, que pode virar manteiga ou queijo.',
  'animal.sheep.name': 'Ovelha',
  'animal.sheep.fact': 'As ovelhas têm um casaco de lã que pode ser tosquiado e fiado para fazer roupa.',

  'building.mill.name': 'Moinho',
  'building.bakery.name': 'Padaria',
  'building.churn.name': 'Batedeira de Manteiga',
  'building.kitchen.name': 'Cozinha',

  'recipe.flour.name': 'Moer Farinha',
  'recipe.flour.fact': 'As pedras do moinho trituram o grão seco de trigo, transformando-o em farinha fina.',
  'recipe.bread.name': 'Cozer Pão',
  'recipe.bread.fact': 'Cozer combina farinha, água e calor para transformar grão em pão fresco.',
  'recipe.butter.name': 'Bater Manteiga',
  'recipe.butter.fact': 'Bater o leite agita a nata até se juntar, formando manteiga.',
  'recipe.sauce.name': 'Cozinhar Molho de Tomate',
  'recipe.sauce.fact': 'Cozinhar tomates maduros em lume brando transforma-os num molho rico.',

  'mission.first-plant.title': 'Prepare o Seu Primeiro Terreno',
  'mission.first-plant.description': 'Plante qualquer cultura num terreno vazio.',
  'mission.first-plant.learned': 'Toda a cultura começa como uma pequena semente plantada em solo preparado.',

  'mission.first-wheat.title': 'Cultive o Seu Primeiro Trigo',
  'mission.first-wheat.description': 'Colha 1 trigo.',
  'mission.first-wheat.learned': 'O trigo demora tempo a crescer — esse tempo é parte do motivo pelo qual produzir comida dá trabalho.',

  'mission.carrot-patch.title': 'Horta de Cenouras',
  'mission.carrot-patch.description': 'Colha 10 cenouras.',
  'mission.carrot-patch.learned': 'As cenouras crescem depressa, mas ainda é preciso plantar muitas para juntar uma boa colheita.',

  'mission.chicken-chores.title': 'Tarefas com as Galinhas',
  'mission.chicken-chores.description': 'Alimente uma galinha.',
  'mission.chicken-chores.learned': 'As galinhas precisam de comida, água e um galinheiro seguro para se manterem saudáveis e pôr ovos.',

  'mission.egg-collector.title': 'Colecionador de Ovos',
  'mission.egg-collector.description': 'Colete 3 ovos.',
  'mission.egg-collector.learned': 'Recolher ovos regularmente dá espaço às galinhas para porem mais.',

  'mission.grain-to-flour.title': 'Do Grão à Farinha',
  'mission.grain-to-flour.description': 'Transforme trigo em farinha no Moinho.',
  'mission.grain-to-flour.learned': 'Moer tritura o grão seco de trigo, transformando-o em farinha fina e leve.',

  'mission.bake-bread.title': 'Coza Pão',
  'mission.bake-bread.description': 'Coza pão na Padaria.',
  'mission.bake-bread.learned': 'Farinha, água e calor combinam-se para cozer pão fresco.',

  'mission.right-season.title': 'Cultura Certa, Estação Certa',
  'mission.right-season.description': 'Plante uma cultura que cresça bem na estação atual.',
  'mission.right-season.learned': 'Plantar uma cultura na sua estação certa dá-lhe o clima em que ela cresce melhor.',

  'ui.rotate.title': 'Rode o seu dispositivo',
  'ui.rotate.body': 'O Little Farm School joga-se na horizontal.<br>Rode o telemóvel de lado para continuar.',
  'ui.hud.fullscreen': 'Ecrã inteiro'
};
